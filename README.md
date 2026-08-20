# SPALONE X ZEPH

Mini sistema estático para organizar acessos de clientes em uma única tela.

## Recursos

- Cofre protegido por senha mestre
- Criptografia AES-GCM no navegador
- Criação, edição e exclusão de acessos
- Busca, categorias e ordenação
- Campos para hospedagem, sites, Instagram, e-mails, telefone, recuperação, 2FA e cartão
- Copiar login/senha rapidamente
- Mostrar/ocultar senha e número do cartão
- Exportação e importação de backup criptografado
- Bloqueio automático após 15 minutos
- Layout preto e branco responsivo

## Como publicar no GitHub Pages

1. Crie um repositório no GitHub.
2. Envie `index.html`, `style.css`, `app.js` e `initial-vault.json` para a raiz.
3. Em **Settings > Pages**, selecione **Deploy from a branch**.
4. Escolha a branch `main` e a pasta `/root`.
5. Salve e abra a URL gerada pelo GitHub Pages.

## Segurança

Os logins não ficam expostos em texto puro nos arquivos do projeto. Esta versão inclui um `initial-vault.json` criptografado para carregar os acessos iniciais no primeiro uso. A senha mestre não é armazenada no projeto.

Isso significa que os dados não sincronizam automaticamente entre computadores ou navegadores. Para trocar de dispositivo, use **Exportar** e depois **Importar**.

Não existe recuperação da senha mestre. Se ela for perdida, o conteúdo criptografado não poderá ser aberto.

Por segurança, o sistema não possui campo de CVV.

Para uso empresarial com múltiplos usuários, auditoria, permissões ou sincronização online, o ideal é migrar para um backend autenticado e um gerenciador de segredos dedicado.


## Cofre inicial desta versão

Esta entrega inclui os acessos iniciais já organizados e criptografados em `initial-vault.json`. No primeiro acesso pelo GitHub Pages, digite a senha mestre enviada separadamente para abrir o cofre.

Depois que abrir e confirmar os dados, use **Exportar** para guardar um backup criptografado. Para reduzir ainda mais a exposição do arquivo criptografado no repositório público, você pode remover `initial-vault.json` do GitHub após o primeiro uso. O cofre continuará salvo no navegador em que foi aberto.

O código de segurança do cartão (CVV) não é armazenado.
