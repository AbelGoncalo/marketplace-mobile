# Firebase para Android

## Ponto Certo · Guia de configuração

Guia preparado em 14 de novembro de 2026 para o projeto Marketplace-mobile. Objetivo: preparar o Firebase Cloud Messaging (FCM), o serviço que entrega alertas Android, em conjunto com Expo Push.

## Antes de começar

Precisas de uma conta Google, acesso à conta Expo e ao computador do projeto. O identificador Android já definido é <b>com.khs.marketplace</b>. Não o substituas por um nome inventado. O Firebase não substitui a API Laravel nem a base de dados do Marketplace.

## 1. Criar o projeto Firebase

Abre <link href="https://console.firebase.google.com" color="#304D8F">console.firebase.google.com</link>, entra na conta Google e cria um projeto. Podes usar “Ponto Certo Development” como nome visível. Revê o identificador atribuído antes de confirmar. Analytics é opcional para esta preparação; podes configurá-lo mais tarde.

## 2. Registar a aplicação Android

No projeto Firebase, adiciona uma aplicação Android. Introduz exatamente <b>com.khs.marketplace</b> no campo do nome do pacote. Usa “Ponto Certo Android” como nome descritivo, se quiseres. Conclui o registo e descarrega <b>google-services.json</b>.

## Resultado esperado

O painel Firebase apresenta uma aplicação Android com o pacote correto. Tens o ficheiro de configuração dessa aplicação. Ainda não é possível testar push apenas por ter criado o projeto.

# Ficheiros e credenciais

## 3. Entregar a configuração ao projeto

Guarda google-services.json na raiz de marketplace-mobile, sem alterar o nome nem o conteúdo. Este é o ficheiro de configuração do cliente Android; não é a chave privada do servidor. Confirma que o pacote dentro dele corresponde ao da aplicação.

## 4. Preparar a credencial de envio

No Firebase, abre as definições do projeto e a área de contas de serviço. Gera a chave privada necessária ao FCM V1 apenas quando fores configurar o envio no Expo. Guarda esse JSON fora do repositório, numa pasta privada do computador.

## Distinguir os dois JSON

<b>google-services.json:</b> configuração usada na aplicação Android.<br/><b>Chave da conta de serviço:</b> credencial privada usada pelo serviço de envio. Não colocar no APK, em EXPO_PUBLIC_*, no Git ou nesta conversa.

## 5. Associar a credencial ao Expo

No projeto correto em expo.dev, abre as credenciais Android e configura a chave FCM V1 para o identificador com.khs.marketplace. Também existe a alternativa pela ferramenta EAS: escolher Android, a área de conta de serviço Google e a configuração de push FCM V1. Os nomes dos menus podem variar.

## O que deves confirmar

O projeto Firebase e a aplicação Android são os pretendidos. A chave configurada no Expo pertence a esse projeto. Não partilhes a chave privada para pedir ajuda: basta informar que a configuração foi concluída.

# Preparação no computador

## 6. Instalar as bibliotecas

A tentativa anterior ficou pendente por timeout no npm. Quando a ligação estiver estável, executar na pasta marketplace-mobile:

## COMANDO

npx expo install expo-dev-client expo-notifications expo-device

## 7. Associar o projeto Expo

Entrar na conta Expo e associar o projeto local ao projeto correto. O identificador projectId deve ser o valor real fornecido pelo Expo; não usar o identificador Firebase nesse campo. Esta associação será revista na próxima etapa com o agente.

## 8. Rever a configuração Android

Configurar expo.android.googleServicesFile para ./google-services.json, o plugin expo-notifications e o projectId real. O projeto já contém uma pasta android/. Antes de compilar, é necessário rever também a configuração Gradle e os ficheiros nativos, pois só editar app.json não os sincroniza automaticamente.

## Preservar o trabalho existente

Não executar prebuild --clean nem substituir a pasta android/ sem rever as alterações existentes. O guia prepara a sequência; não executou nem concluiu esta integração nativa. Não adicionar os exemplos genéricos de dependências do assistente Firebase por cima do projeto Expo sem essa revisão.

## Resultado esperado

Dependências instaladas e configuração Expo/Firebase coerente. O perfil development já existe em eas.json. A aplicação ainda precisa de ser compilada e de integrar permissões e registo do dispositivo.

# Compilação e validação

## 9. Gerar e instalar a versão de desenvolvimento

Depois da revisão nativa e da autorização para compilar, usar os comandos seguintes. A compilação EAS envia o projeto ao serviço Expo. Instala no telefone o APK de desenvolvimento resultante.

## COMANDO

npx eas-cli login<br/>npx eas-cli build --platform android --profile development<br/>npm run start:dev-client

## 10. Testar na etapa de integração push

No Android, permitir notificações quando solicitado. O mobile terá de obter um token Expo e registá-lo na API. Depois testar uma notificação com a aplicação aberta e em segundo plano. Ao tocar, o comportamento pretendido é abrir a mensagem completa antes de navegar para o processo.

## Se algo falhar

Expo Go não é o ambiente de teste de push remoto Android deste projeto. Sem token, verificar configuração FCM e permissões. Token registado mas sem alerta: verificar credenciais de envio, fila da API e resposta do operador. Sem acesso à API local: confirmar rede e endereço do computador. Não desativar a validação HTTPS para contornar erros.

## O que está concluído e o que falta

Preparado: perfil de desenvolvimento e instruções locais. Pendente: instalação das novas bibliotecas, Firebase, credenciais, sincronização nativa, APK e integração push no mobile. A caixa interna de notificações já implementada é independente desta preparação.

## Fontes oficiais e continuação

<link href="https://firebase.google.com/docs/android/setup" color="#304D8F">Firebase: adicionar uma aplicação Android</link><br/><link href="https://docs.expo.dev/push-notifications/fcm-credentials/" color="#304D8F">Expo: credenciais FCM V1</link><br/><link href="https://docs.expo.dev/develop/development-builds/introduction/" color="#304D8F">Expo: development builds</link><br/>Após criares o projeto e descarregares google-services.json, retomamos a revisão técnica antes de compilar.
