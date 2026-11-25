# Marketplace Mobile

Aplicação móvel do Marketplace, construída com React Native, Expo e JavaScript.

## Requisitos

- Node.js 22.13 ou superior
- npm
- Expo Go ou um emulador Android/iOS

## Executar

```bash
cp .env.example .env
npm install
npm start
```

Depois, use `a` para Android, `i` para iOS ou leia o QR Code com o Expo Go.

Para usar a API num telemóvel físico, pare o servidor anterior da porta 8000 e, na pasta mobile, inicie o Laravel com os limites de anexos e acesso pela rede:

```bash
bash scripts/serve-api-mobile.sh ../Teste-api
```

Em `.env`, configure `EXPO_PUBLIC_API_URL` com o IP atual do computador, por exemplo `http://192.168.0.87:8000/api`. O computador
e o telemóvel devem estar ligados à mesma rede Wi-Fi.

### Link de recuperação de senha

A API deve gerar o link para a rota pública `/reset-password`, incluindo `token` e `email`.
Durante o desenvolvimento com um development build, pode usar o esquema da aplicação:

```env
PASSWORD_RESET_URL=ponto-certo://reset-password
```

Em produção, use uma URL HTTPS do domínio associado à aplicação, por exemplo
`https://app.exemplo.ao/reset-password`. O domínio precisa publicar os ficheiros de associação
da Apple e do Android antes de ser adicionado a `associatedDomains` e `intentFilters` no Expo.

## Comandos úteis

```bash
npm test              # regressões de sessão, catálogo, carrinho e permissões
npm run lint          # encontra problemas e inconsistências
npm run lint:fix      # corrige automaticamente o que for seguro
npm run format        # formata todos os arquivos
npm run format:check  # apenas verifica a formatação
npm run doctor        # verifica a compatibilidade do projeto Expo
```

## Estrutura atual

```text
app/                           # Rotas do Expo Router
├── _layout.js                 # Providers e navegação raiz
├── (auth)/                    # Login, cadastro e recuperação
├── (customer)/(tabs)/         # Marketplace e área do cliente
├── (super-admin)/             # Supervisão global
├── (shopping-center-admin)/   # Operação de um centro comercial
└── (merchant)/                # Operação do lojista
src/
├── config/                   # Ambiente e configurações públicas
├── features/
│   └── home/
│       └── screens/          # Tela pertencente ao domínio Home
├── shared/
│   ├── components/           # Componentes compostos do marketplace
│   ├── constants/            # Constantes sem regra de negócio
│   └── ui/                   # Design system reutilizável
└── theme/                    # Tokens visuais
```

### Por que organizar por funcionalidade?

Quando a aplicação crescer, cada domínio (`auth`, `catalog`, `cart`, `orders`) terá
os seus componentes, hooks e acessos à API. Isso reduz dependências acidentais e
facilita encontrar tudo o que pertence a uma funcionalidade.

### JavaScript com JSDoc

O projeto não usa TypeScript. O `jsconfig.json` habilita verificação de JavaScript
e autocomplete no editor. JSDoc documenta contratos importantes, como as props de
um componente, sem gerar arquivos `.ts` ou `.tsx`.

### Alias `@/`

`@/` aponta para `src/`. Assim, usamos `@/theme` em vez de caminhos frágeis como
`../../../theme`. Depois de alterar aliases, é necessário reiniciar o servidor Expo.

### Variáveis de ambiente

Copie `.env.example` para `.env`. O Expo expõe no aplicativo apenas variáveis com
o prefixo `EXPO_PUBLIC_`. Elas são públicas: tokens, passwords e chaves privadas
nunca devem ser guardados nelas.

### Design system

Os tokens em `src/theme` guardam decisões visuais: cores, tipografia, espaçamento,
raios e sombras. Os componentes em `src/shared/ui` consomem esses tokens:

- `AppText`: hierarquia tipográfica consistente;
- `Button`: ações primária, amarela, contornada e destrutiva;
- `Input`: label, ajuda e erro com o mesmo padrão;
- `Card`: superfície estática ou pressionável;
- `Badge`: estado ou promoção em pouco espaço;
- `Screen`: área segura, scroll e espaçamento das telas;
- `LoadingState`: feedback padronizado durante carregamentos.

Um token semântico como `colors.danger` explica a função da cor. Se o vermelho da
marca mudar, atualizamos um único arquivo em vez de procurar `#ED111C` em cada tela.

### Navegação com Expo Router

Cada arquivo dentro de `app/` representa uma rota. Os arquivos de rota permanecem
pequenos e importam a implementação de `src/features`. Pastas entre parênteses,
como `(tabs)`, agrupam rotas sem aparecer no endereço público.

A barra inferior do grupo `(customer)` possui Início, Categorias, Favoritos, Carrinho e Perfil. O esquema
`ponto-certo://` também deixa o projeto preparado para deep links futuros.

O acesso administrativo exige os papéis explícitos devolvidos pela API; o nome do tipo de conta não concede permissões.

Cada perfil administrativo possui um grupo próprio e um `_layout.js` que valida o
papel antes de renderizar as suas telas. Os nomes entre parênteses organizam o código,
mas não fazem parte do URL gerado pelo Expo Router.

