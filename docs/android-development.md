# Android de desenvolvimento e preparação de push

Esta etapa prepara as ferramentas locais. Não publica a aplicação nem configura
uma conta Firebase. O push remoto não é testável no Expo Go Android.

## Configuração preparada

- Instalação pendente de `expo-dev-client`: ferramentas da aplicação própria.
- Instalação pendente de `expo-notifications` e `expo-device`: futura integração push.
- Perfil `development` em `eas.json`: APK para distribuição interna.
- `npm run start:dev-client`: servidor para a aplicação própria instalada.

A instalação das bibliotecas não solicita permissões nem regista dispositivos.
A caixa de mensagens existente continua independente dos alertas push.

## Instalação pendente por falha de rede

A ligação ao registo npm apresentou timeout. As bibliotecas não foram instaladas;
o manifesto mantém as dependências anteriores para não divergir do lockfile.
Quando a rede estiver disponível, executar:

```sh
npx expo install expo-dev-client expo-notifications expo-device
```

Validar as dependências e sincronizar o projeto nativo antes de compilar.

## Próxima etapa: Firebase e Expo

1. Criar um projeto no Firebase Console.
2. Adicionar uma aplicação Android com o identificador `com.khs.marketplace`.
3. Descarregar o ficheiro público `google-services.json` dessa aplicação.
4. Associar o projeto local à conta/projeto Expo e obter o `projectId` real.
5. Configurar `android.googleServicesFile`, o `projectId` e o plugin de notificações.
6. Configurar as credenciais FCM V1 no projeto Expo, seguindo a documentação oficial.

A chave privada da conta de serviço FCM deve ser guardada fora do repositório.
Não deve ser incluída no código mobile ou em variáveis `EXPO_PUBLIC_*`.

## Atenção ao projeto Android existente

O repositório já contém `android/`. O EAS utiliza esse projeto nativo; alterações
em plugins/app.json não são automaticamente aplicadas como num projeto sem essa
pasta. Antes da compilação será necessário rever e sincronizar a configuração
nativa com as alterações existentes, sem executar `prebuild --clean` nem substituir
os ficheiros Android do utilizador. Esta sincronização fica para a etapa de FCM.

## Compilação posterior

Com as configurações reais e o projeto nativo revistos:

```sh
npx eas-cli login
npx eas-cli build --platform android --profile development
```

O comando envia o projeto ao serviço de compilação Expo; só deve ser executado
na etapa de compilação autorizada. Instalar o APK resultante no Android e iniciar:

```sh
npm run start:dev-client
```

O computador e o telefone devem conseguir comunicar com o endereço da API.
Uma API local não fica pública ao criar o APK. Ferramentas de diagnóstico podem
alterar o desempenho; a medição final deve usar uma compilação de produção.

## Referências

- [Development builds](https://docs.expo.dev/develop/development-builds/introduction/)
- [Credenciais Android FCM V1](https://docs.expo.dev/push-notifications/fcm-credentials/)
