const express = require('express');
const cors = require('cors');
const db = require('./database');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// ================= Rotas para Produtos =================

// GET todos os produtos
app.get('/api/produtos', (req, res) => {
    db.all('SELECT * FROM produtos', [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// GET produto por ID
app.get('/api/produtos/:id', (req, res) => {
    db.get('SELECT * FROM produtos WHERE id = ?', [req.params.id], (err, row) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(row);
    });
});

// POST criar produto
app.post('/api/produtos', (req, res) => {
    const { nome, descricao, preco } = req.body;
    db.run('INSERT INTO produtos (nome, descricao, preco) VALUES (?, ?, ?)', [nome, descricao, preco], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.status(201).json({ id: this.lastID, nome, descricao, preco });
    });
});

// PUT atualizar produto
app.put('/api/produtos/:id', (req, res) => {
    const { nome, descricao, preco } = req.body;
    db.run('UPDATE produtos SET nome = ?, descricao = ?, preco = ? WHERE id = ?', [nome, descricao, preco, req.params.id], function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ changes: this.changes });
    });
});

// DELETE produto
app.delete('/api/produtos/:id', (req, res) => {
    db.run('DELETE FROM produtos WHERE id = ?', req.params.id, function (err) {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ changes: this.changes });
    });
});

// ================= Rotas para Vendas =================

// GET todas as vendas
app.get('/api/vendas', (req, res) => {
    db.all(`
        SELECT v.*, t.desconto 
        FROM vendas v
        LEFT JOIN transacoes t ON v.transacaoId = t.id
    `, [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json(rows);
    });
});

// POST nova venda
app.post('/api/vendas', (req, res) => {
    const { dataVenda, produtosSelecionados, desconto = 0 } = req.body;

    db.run('BEGIN TRANSACTION');

    db.run('INSERT INTO transacoes (dataVenda, desconto) VALUES (?, ?)', [dataVenda, desconto], function (err) {
        if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: 'Erro ao criar transação: ' + err.message });
            return;
        }

        const transacaoId = this.lastID;
        const totalSemDesconto = produtosSelecionados.reduce((soma, p) => soma + p.valorTotal, 0);

        const stmt = db.prepare(`
            INSERT INTO vendas 
            (transacaoId, produtoId, nomeProduto, quantidade, preco, valorTotal, descontoItem, dataVenda) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);

        produtosSelecionados.forEach(item => {
            const proporcao = totalSemDesconto > 0 ? item.valorTotal / totalSemDesconto : 0;
            const descontoItem = parseFloat((proporcao * desconto).toFixed(2));
            const valorFinal = item.valorTotal - descontoItem;

            stmt.run(transacaoId, item.produtoId, item.nome, item.quantidade, item.preco, valorFinal, descontoItem, dataVenda);
        });

        stmt.finalize(err => {
            if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: 'Erro ao inserir itens da venda: ' + err.message });
                return;
            }
            db.run('COMMIT', err => {
                if (err) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: 'Erro ao finalizar transação: ' + err.message });
                    return;
                }
                res.status(201).json({ message: 'Venda registrada com sucesso', transacaoId });
            });
        });
    });
});

// PUT editar venda
app.put('/api/vendas/:transacaoId', (req, res) => {
    const { transacaoId } = req.params;
    const { dataVenda, produtosSelecionados, desconto = 0 } = req.body;

    db.run('BEGIN TRANSACTION');

    db.run('UPDATE transacoes SET dataVenda = ?, desconto = ? WHERE id = ?', [dataVenda, desconto, transacaoId], (err) => {
        if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: 'Erro ao atualizar data/desconto da transação: ' + err.message });
            return;
        }

        db.run('DELETE FROM vendas WHERE transacaoId = ?', [transacaoId], (err) => {
            if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: 'Erro ao deletar itens antigos: ' + err.message });
                return;
            }

            const totalSemDesconto = produtosSelecionados.reduce((soma, p) => soma + p.valorTotal, 0);
            const stmt = db.prepare(`
                INSERT INTO vendas 
                (transacaoId, produtoId, nomeProduto, quantidade, preco, valorTotal, descontoItem, dataVenda) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            produtosSelecionados.forEach(item => {
                const proporcao = totalSemDesconto > 0 ? item.valorTotal / totalSemDesconto : 0;
                const descontoItem = parseFloat((proporcao * desconto).toFixed(2));
                const valorFinal = item.valorTotal - descontoItem;

                stmt.run(transacaoId, item.produtoId, item.nome, item.quantidade, item.preco, valorFinal, descontoItem, dataVenda);
            });

            stmt.finalize(err => {
                if (err) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: 'Erro ao inserir novos itens: ' + err.message });
                    return;
                }
                db.run('COMMIT', err => {
                    if (err) {
                        db.run('ROLLBACK');
                        res.status(500).json({ error: 'Erro ao finalizar transação: ' + err.message });
                        return;
                    }
                    res.json({ message: 'Transação atualizada com sucesso.' });
                });
            });
        });
    });
});

// DELETE venda
app.delete('/api/vendas/:transacaoId', (req, res) => {
    const { transacaoId } = req.params;

    db.run('BEGIN TRANSACTION');
    db.run('DELETE FROM vendas WHERE transacaoId = ?', [transacaoId], (err) => {
        if (err) {
            db.run('ROLLBACK');
            res.status(500).json({ error: 'Erro ao deletar itens da venda: ' + err.message });
            return;
        }

        db.run('DELETE FROM transacoes WHERE id = ?', [transacaoId], (err) => {
            if (err) {
                db.run('ROLLBACK');
                res.status(500).json({ error: 'Erro ao deletar transação: ' + err.message });
                return;
            }

            db.run('COMMIT', err => {
                if (err) {
                    db.run('ROLLBACK');
                    res.status(500).json({ error: 'Erro ao finalizar exclusão: ' + err.message });
                    return;
                }
                res.json({ message: 'Transação e seus itens excluídos com sucesso.' });
            });
        });
    });
});

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
