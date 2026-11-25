<?php

/**
 * Valida o serviço real com processos e ligações MySQL independentes.
 * Uso: php tests/integration/order-completion-mysql.php /caminho/Teste-api
 * Cria e conserva uma base isolada; não modifica a base configurada da API.
 */
use App\Models\Order\Order;
use App\Models\Order\OrderGroup;
use App\Services\Order\OrderReceiptService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

$backend = realpath($argv[1] ?? __DIR__.'/../../../Teste-api');
if (! $backend || ! is_file($backend.'/vendor/autoload.php') || ! extension_loaded('pcntl')) {
    throw new RuntimeException('Indique a Teste-api com vendor instalado e ative pcntl.');
}
require $backend.'/vendor/autoload.php';
$app = require $backend.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
config(['logging.default' => 'stderr']);

/** Falha explicitamente quando uma condição da jornada deixa de ser satisfeita. */
function verifyCompletion(bool $condition, string $message): void
{
    if (! $condition) {
        throw new RuntimeException($message);
    }
}

// Apenas CREATE DATABASE é executado na ligação original; os dados de teste usam outra ligação.
$original = DB::connection();
verifyCompletion(in_array($original->getDriverName(), ['mysql', 'mariadb'], true), 'A API deve usar MySQL/MariaDB.');
$database = 'marketplace_completion_check_'.date('Ymd_His').'_'.bin2hex(random_bytes(3));
$original->statement('CREATE DATABASE `'.$database.'` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci');
$connection = $original->getConfig();
$connection['database'] = $database;
$connection['url'] = null;
$connection['name'] = 'completion_validation';
config(['database.connections.completion_validation' => $connection]);
DB::setDefaultConnection('completion_validation');
DB::purge($original->getName());
$original = null;
echo "Base isolada conservada: {$database}\n";

// Reproduz as tabelas e campos usados pelo serviço, com InnoDB e índices de relação.
Schema::create('order_groups', function (Blueprint $table): void {
    $table->engine = 'InnoDB';
    $table->id();
    $table->string('order_status');
    $table->string('payment_status');
    $table->timestamps();
});
Schema::create('orders', function (Blueprint $table): void {
    $table->engine = 'InnoDB';
    $table->id();
    $table->foreignId('order_group_id')->constrained();
    $table->dateTime('customer_received_at')->nullable();
    $table->timestamps();
});
Schema::create('order_items', function (Blueprint $table): void {
    $table->engine = 'InnoDB';
    $table->id();
    $table->foreignId('order_id')->constrained();
    $table->boolean('return_allowed_snapshot')->default(true);
    $table->integer('return_window_days_snapshot')->default(14);
    $table->dateTime('return_deadline_at')->nullable();
    $table->timestamps();
});
Schema::create('order_group_status_histories', function (Blueprint $table): void {
    $table->engine = 'InnoDB';
    $table->id();
    $table->foreignId('order_group_id')->constrained();
    $table->string('event');
    $table->string('order_status');
    $table->string('payment_status');
    $table->text('description');
    $table->json('metadata');
    $table->dateTime('occurred_at');
    $table->timestamps();
});

/** Cria duas encomendas sintéticas e devolve identificadores já confirmados na base. */
function completionFixture(): array
{
    $group = OrderGroup::query()->create(['order_status' => 'CONFIRMED', 'payment_status' => 'APPROVED']);
    $ids = [];
    for ($i = 0; $i < 2; $i++) {
        $order = Order::query()->create(['order_group_id' => $group->id]);
        $order->items()->create(['return_allowed_snapshot' => true, 'return_window_days_snapshot' => 14]);
        $ids[] = $order->id;
    }
    return [$group->id, $ids];
}

/** Aguarda um sinal com limite; impede que uma falha deixe os processos bloqueados. */
function completionSignal(string $path): void
{
    $limit = microtime(true) + 12;
    while (! is_file($path)) {
        if (microtime(true) > $limit) {
            throw new RuntimeException('Tempo excedido à espera do outro processo.');
        }
        usleep(10000);
    }
}

// Verifica também a ligação interna dos modelos antes de qualquer escrita de dados.
verifyCompletion(OrderGroup::query()->getConnection()->getName() === 'completion_validation', 'Nome da ligação de modelo incorreto.');
verifyCompletion(OrderGroup::query()->getConnection()->getDatabaseName() === $database, 'O modelo não está na base isolada.');
[$groupId, $ids] = completionFixture();
$signals = sys_get_temp_dir().'/'.$database;
mkdir($signals, 0700);
// Não partilha sockets PDO herdados: cada processo abre a sua própria ligação.
DB::purge('completion_validation');
$pids = [];
foreach ($ids as $index => $orderId) {
    $pid = pcntl_fork();
    verifyCompletion($pid !== -1, 'Não foi possível criar o processo de teste.');
    if ($pid === 0) {
        try {
            DB::purge('completion_validation');
            DB::statement('SET SESSION TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            DB::statement('SET SESSION innodb_lock_wait_timeout = 10');
            if ($index === 1) {
                completionSignal($signals.'/first-locked');
            }
            $wait = 0;
            DB::transaction(function () use ($index, $orderId, $signals, &$wait): void {
                $receipt = app(OrderReceiptService::class);
                // A consulta anterior ao bloqueio cria deliberadamente um snapshot antigo.
                $order = Order::query()->findOrFail($orderId);
                if ($index === 1) {
                    file_put_contents($signals.'/second-attempting', 'ready');
                }
                $start = microtime(true);
                $receipt->lockGroupForReceipt($order);
                $wait = microtime(true) - $start;
                if ($index === 0) {
                    file_put_contents($signals.'/first-locked', 'ready');
                    completionSignal($signals.'/second-attempting');
                    usleep(350000);
                }
                // Espelha a ordem grupo → encomenda das rotas de confirmação.
                $order = Order::query()->lockForUpdate()->findOrFail($orderId);
                $receipt->markReceived($order, now()->startOfSecond());
            });
            file_put_contents($signals.'/result-'.$index, json_encode(['ok' => true, 'wait' => $wait]));
            DB::disconnect('completion_validation');
            exit(0);
        } catch (Throwable $error) {
            file_put_contents($signals.'/result-'.$index, json_encode(['ok' => false, 'error' => $error->getMessage()]));
            exit(1);
        }
    }
    $pids[] = $pid;
}
foreach ($pids as $index => $pid) {
    pcntl_waitpid($pid, $status);
    $result = json_decode(file_get_contents($signals.'/result-'.$index), true);
    verifyCompletion(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0 && $result['ok'], 'Falha num processo: '.json_encode($result));
    if ($index === 1) {
        verifyCompletion($result['wait'] >= 0.25, 'O segundo processo não aguardou pelo bloqueio.');
    }
}
$group = OrderGroup::query()->findOrFail($groupId);
verifyCompletion($group->order_status === 'COMPLETED', 'A compra ficou por concluir.');
verifyCompletion($group->payment_status === 'APPROVED', 'O pagamento foi alterado.');
verifyCompletion($group->orders()->whereNotNull('customer_received_at')->count() === 2, 'Falta uma receção.');
verifyCompletion($group->statusHistories()->where('event', 'ORDER_COMPLETED')->count() === 1, 'Histórico duplicado ou ausente.');
echo "PASS: duas receções concorrentes, snapshot antigo, bloqueio efetivo e conclusão única.\n";

// Confirma repetição segura depois da concorrência e preservação dos prazos.
$order = Order::query()->findOrFail($ids[0]);
$received = $order->customer_received_at->toDateTimeString();
$deadline = $order->items()->firstOrFail()->return_deadline_at->toDateTimeString();
app(OrderReceiptService::class)->markReceived($order, now()->addDay());
verifyCompletion($order->fresh()->customer_received_at->toDateTimeString() === $received, 'Receção original alterada.');
verifyCompletion($order->items()->firstOrFail()->return_deadline_at->toDateTimeString() === $deadline, 'Prazo original alterado.');
verifyCompletion($group->statusHistories()->count() === 1, 'Repetição duplicou o histórico.');
echo "PASS: repetição preserva receção, prazo e histórico.\n";

// Uma falha posterior deve reverter receção e conclusão dentro da transação externa.
[$rollbackGroup, $rollbackIds] = completionFixture();
try {
    DB::transaction(function () use ($rollbackIds): void {
        foreach ($rollbackIds as $id) {
            app(OrderReceiptService::class)->markReceived(Order::query()->findOrFail($id), now());
        }
        throw new RuntimeException('rollback-intencional');
    });
} catch (RuntimeException $error) {
    verifyCompletion($error->getMessage() === 'rollback-intencional', 'Falha inesperada no rollback.');
}
$group = OrderGroup::query()->findOrFail($rollbackGroup);
verifyCompletion($group->order_status === 'CONFIRMED', 'Rollback não reverteu o estado.');
verifyCompletion($group->orders()->whereNotNull('customer_received_at')->count() === 0, 'Rollback não reverteu receções.');
verifyCompletion($group->statusHistories()->count() === 0, 'Rollback não reverteu histórico.');
echo "PASS: rollback reverte receções e conclusão global.\n";
