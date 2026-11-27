const { createApp } = require('./app');

const PORT = process.env.PORT || 3000;
const { app } = createApp();

app.listen(PORT, () => {
  console.log(`Library Lending System API running on http://localhost:${PORT}`);
  console.log(`Endpoints available:`);
  console.log(` - GET  /books/:bookId/availability`);
  console.log(` - POST /holds`);
  console.log(` - POST /reminders/overdue`);
  console.log(` - GET  /health`);
});
