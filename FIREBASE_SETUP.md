# Configuração dos dados online

1. Crie um projeto no Firebase no plano Spark.
2. Ative Authentication > Sign-in method > Google.
3. Em Authentication > Settings > Authorized domains, adicione `marceloauditor.github.io`.
4. Crie o Cloud Firestore em modo de produção.
5. Em Firestore > Rules, substitua o conteúdo pelas regras de `firestore.rules` e publique.
6. Em Configurações do projeto > Seus apps, crie um app Web.
7. A configuração do aplicativo Web já está gravada em `firebase-config.js`.
8. Publique todos os arquivos no GitHub Pages.

No primeiro login, se não existir uma base online, o aplicativo enviará automaticamente o histórico local e o dataset inicial. Depois disso, o Firestore será a fonte sincronizada entre os aparelhos.
