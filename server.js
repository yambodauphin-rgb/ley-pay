require('dotenv').config();
const mongoose = require('mongoose');

// On garde l'astuce de découpage pour bloquer l'injecteur automatique de ton terminal
const dbUser = "yambodauphin" + "_db_user";
const dbPass = "YAMBO1971";
const dbHosts = "ac-amin2dr-shard-00-00.432sx7q.mongodb.net:27017,ac-amin2dr-shard-00-01.432sx7q.mongodb.net:27017,ac-amin2dr-shard-00-02.432sx7q.mongodb.net:27017/?ssl=true&replicaSet=atlas-j6zw0m-shard-0&authSource=admin&appName=Cluster0";

const cleanURI = `mongodb://${dbUser}:${dbPass}@${dbHosts}`;

mongoose.connect(cleanURI)
  .then(() => console.log('✅ Connexion à MongoDB réussie !'))
  .catch(err => console.error('❌ Erreur de connexion MongoDB :', err));
const express = require('express');
const app = express();
const PORT = 3000;
// 3. Les middlewares
app.use(express.json());
app.use(express.static(__dirname));

// 4.1 La route d'inscription
app.post('/api/inscription', (req, res) => {
    const { nom, email, mdp } = req.body; 
    
    const sql = 'INSERT INTO utilisateurs (nom, email, motDePasse) VALUES (?, ?, ?)';
    
    db.query(sql, [nom, email, mdp], (err, result) => {
        if (err) {
            console.error("❌ Erreur MySQL :", err);
            return res.status(500).json({ message: "Erreur lors de l'enregistrement." });
        }
        
        console.log(`👤 Nouvel utilisateur inscrit : ${nom}`);
        res.json({ message: `Compte créé avec succès dans MySQL pour ${nom} !` });
    });
});

// 4.2 LA ROUTE DE CONNEXION (Nouvelle !)
app.post('/api/connexion', (req, res) => {
    const { email, mdp } = req.body;

    const sql = 'SELECT * FROM utilisateurs WHERE email = ? AND motDePasse = ?';

    db.query(sql, [email, mdp], (err, results) => {
        if (err) {
            console.error("❌ Erreur MySQL lors de la connexion :", err);
            return res.status(500).json({ success: false, message: "Erreur serveur." });
        }

        if (results.length > 0) {
            const user = results[0];
            console.log(`🔑 Connexion réussie pour : ${user.nom}`);
            res.json({ success: true, message: `Bienvenue ${user.nom} !`, user: { nom: user.nom, email: user.email } });
        } else {
            res.status(401).json({ success: false, message: "Adresse e-mail ou mot de passe incorrect." });
        }
    });
});
// 4.3 ROUTE POUR RÉCUPÉRER LES PRODUITS (Avec le stock)
app.get('/api/produits', (req, res) => {
    // Note : Assure-toi que le nom de ta table est bien 'produits' et qu'elle contient la colonne 'stock'
    const sql = 'SELECT * FROM produits'; 
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error("❌ Erreur MySQL lors de la récupération des produits :", err);
            return res.status(500).json({ error: "Impossible de charger les produits." });
        }
        res.json(results); // Envoie la liste des produits avec leurs stocks au format JSON
    });
});

// 4.4 ROUTE POUR VALIDER LA COMMANDE (Met à jour les stocks)
app.post('/api/commande/valider', (req, res) => {
    const { items } = req.body; // Reçoit le panier envoyé par le client

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: "Le panier est vide." });
    }

    // Chaîne de requêtes pour mettre à jour chaque produit une par une
    let erreurs = false;
    let requetesTerminees = 0;

    items.forEach(item => {
        const sql = 'UPDATE produits SET stock = stock - ? WHERE id = ?';
        
        db.query(sql, [item.qty, item.id], (err, result) => {
            requetesTerminees++;
            
            if (err) {
                console.error(`❌ Erreur de stock pour le produit ID ${item.id}:`, err);
                erreurs = true;
            }

            // Une fois que tous les produits du panier ont été traités
            if (requetesTerminees === items.length) {
                if (erreurs) {
                    return res.status(500).json({ success: false, message: "Erreur lors de la mise à jour de certains stocks." });
                }
                console.log("📦 Une commande a été validée et les stocks mis à jour dans MySQL !");
                res.json({ success: true, message: "Commande enregistrée avec succès !" });
            }
        });
    });
});

// 5. Lancement du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur http://localhost:${PORT}`);
});
