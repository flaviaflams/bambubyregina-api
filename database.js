const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./bambubyregina.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Conectado ao banco de dados SQLite.');
});

// Cria as tabelas
db.serialize(() => {
    // Tabela de Produtos
    db.run(`CREATE TABLE IF NOT EXISTS produtos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nome TEXT NOT NULL,
        descricao TEXT,
        preco REAL NOT NULL
    )`);

    // Tabela de Vendas
    db.run(`CREATE TABLE IF NOT EXISTS vendas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        transacaoId INTEGER NOT NULL,
        produtoId INTEGER NOT NULL,
        nomeProduto TEXT NOT NULL,
        quantidade INTEGER NOT NULL,
        preco REAL NOT NULL,
        valorTotal REAL NOT NULL,
        descontoItem REAL DEFAULT 0,
        dataVenda TEXT NOT NULL
    )`);

    // Tabela de Transações
    db.run(`CREATE TABLE IF NOT EXISTS transacoes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        dataVenda TEXT NOT NULL,
        desconto REAL DEFAULT 0
    )`);

    // Garante que a coluna desconto exista em transacoes
    db.all("PRAGMA table_info(transacoes)", (err, rows) => {
        if (err) {
            console.error("Erro ao verificar colunas da tabela transacoes:", err.message);
            return;
        }
        if (!rows.find(r => r.name === 'desconto')) {
            db.run("ALTER TABLE transacoes ADD COLUMN desconto REAL DEFAULT 0", (err) => {
                if (err) {
                    console.error("Erro ao adicionar coluna desconto em transacoes:", err.message);
                } else {
                    console.log("Coluna desconto adicionada à tabela transacoes.");
                }
            });
        }
    });

    // Garante que a coluna descontoItem exista em vendas
    db.all("PRAGMA table_info(vendas)", (err, rows) => {
        if (err) {
            console.error("Erro ao verificar colunas da tabela vendas:", err.message);
            return;
        }
        if (!rows.find(r => r.name === 'descontoItem')) {
            db.run("ALTER TABLE vendas ADD COLUMN descontoItem REAL DEFAULT 0", (err) => {
                if (err) {
                    console.error("Erro ao adicionar coluna descontoItem em vendas:", err.message);
                } else {
                    console.log("Coluna descontoItem adicionada à tabela vendas.");
                }
            });
        }
    });
});

module.exports = db;
