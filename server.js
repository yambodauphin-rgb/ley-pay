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

// =========================================================
// 1. DÉFINITION DES SCHÉMAS ET MODÈLES MONGOOSE (REQUIS)
// =========================================================

// Schéma pour les Produits
const produitSchema = new mongoose.Schema({
    id: { type: Number, required: true },
    nom: { type: String, required: true },
    prix: { type: Number, required: true },
    stock: { type: Number, required: true },
    cat: { type: String, required: true },
    logistique: { type: String, required: true },
    commission_taux: { type: Number, required: true },
    img: { type: String, required: true },
    img_detail1: { type: String },
    img_detail2: { type: String },
    img_detail3: { type: String },
    vendeur: { type: String, default: "vendeur@test.com" },
    valide: { type: Boolean, default: true }
});
// Enregistrement du modèle 'Produit'
mongoose.model('Produit', produitSchema);

// Schéma pour les Utilisateurs
const utilisateurSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    motDePasse: { type: String, required: true }
});
// Enregistrement du modèle 'Utilisateur'
mongoose.model('Utilisateur', utilisateurSchema);

// =========================================================

const path = require('path'); // AJOUTE CETTE LIGNE ICI 
const express = require('express');
const app = express();
const PORT = 3000;

// 3. Les middlewares
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
// 4.1 La route d'inscription (Note : utilise MySQL d'après ton code actuel)
app.post('/api/inscription', (req, res) => {
    const { nom, email, mdp } = req.body; 
    
    const sql = 'INSERT INTO utilisateurs (nom, email, motDePasse) VALUES (?, ?, ?)';
    
    if (typeof db !== "undefined") {
        db.query(sql, [nom, email, mdp], (err, result) => {
            if (err) {
                console.error("❌ Erreur MySQL :", err);
                return res.status(500).json({ message: "Erreur lors de l'enregistrement." });
            }
            console.log(`👤 Nouvel utilisateur inscrit : ${nom}`);
            res.json({ message: `Compte créé avec succès dans MySQL pour ${nom} !` });
        });
    } else {
        res.status(500).json({ message: "Base de données MySQL non configurée." });
    }
});

// ==========================================
// 4.2 LA ROUTE DE CONNEXION (Version MongoDB)
// ==========================================
app.post('/api/connexion', async (req, res) => {
    const { email, mdp } = req.body;

    try {
        const user = await mongoose.model('Utilisateur').findOne({ email: email, motDePasse: mdp });

        if (user) {
            console.log(`🔑 Connexion réussie pour : ${user.nom}`);
            res.json({ success: true, message: `Bienvenue ${user.nom} !`, user: { nom: user.nom, email: user.email } });
        } else {
            res.status(401).json({ success: false, message: "Adresse e-mail ou mot de passe incorrect." });
        }
    } catch (err) {
        console.error("❌ Erreur MongoDB lors de la connexion :", err);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
});

// =========================================================
// 4.3 ROUTE POUR RÉCUPÉRER LES PRODUITS (Version MongoDB)
// =========================================================
app.get('/api/produits', async (req, res) => {
    try {
        const results = await mongoose.model('Produit').find({});
        res.json(results); 
    } catch (err) {
        console.error("❌ Erreur MongoDB lors de la récupération des produits :", err);
        return res.status(500).json({ error: "Impossible de charger les produits." });
    }
});
// =========================================================
// ROUTE POUR PUBLIER UN PRODUIT DIRECTEMENT EN LIGNE (MongoDB)
// =========================================================
app.post('/api/produits', async (req, res) => {
    try {
        const ProduitModel = mongoose.model('Produit');
        
        // Crée le produit avec les données reçues (nom, prix, images en Base64...)
        const nouveauProduit = new ProduitModel(req.body);
        
        // Enregistrement immédiat dans MongoDB Atlas
        await nouveauProduit.save();
        
        console.log(`📦 Nouveau produit publié en ligne : ${req.body.nom}`);
        res.status(201).json({ success: true, message: "Produit publié avec succès !" });
    } catch (err) {
        console.error("❌ Erreur lors de la publication du produit :", err);
        res.status(500).json({ error: "Impossible de publier le produit sur la plateforme." });
    }
});

// =========================================================
// 4.4 ROUTE POUR VALIDER LA COMMANDE (Version MongoDB)
// =========================================================
app.post('/api/commande/valider', async (req, res) => {
    const { items } = req.body;

    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: "Le panier est vide." });
    }

    try {
        const ProduitModel = mongoose.model('Produit');

        for (const item of items) {
            await ProduitModel.findByIdAndUpdate(item.id, {
                $inc: { stock: -item.qty } 
            });
        }

        console.log("📦 Une commande a été validée et les stocks mis à jour dans MongoDB !");
        res.json({ success: true, message: "Commande enregistrée avec succès !" });

    } catch (err) {
        console.error(`❌ Erreur de mise à jour des stocks dans MongoDB :`, err);
        return res.status(500).json({ success: false, message: "Erreur lors de la mise à jour de certains stocks." });
    }
});
// Route pour supprimer un produit de partout (MongoDB)
app.delete('/api/produits/:id', async (req, res) => {
    try {
        const produitId = req.params.id;
        
        // CORRECTION : Récupération sécurisée du modèle déjà enregistré sur mongoose
        const MonModeleProduit = mongoose.models.Produit || mongoose.model('Produit');
        
        // Suppression du produit via son identifiant unique
        const resultat = await MonModeleProduit.deleteOne({ _id: produitId });
        
        if (resultat.deletedCount === 0) {
            return res.status(404).json({ success: false, message: "Produit introuvable ou déjà supprimé." });
        }
        
        console.log(`🗑️ Produit supprimé de MongoDB avec succès : ${produitId}`);
        res.json({ success: true, message: "Le produit a été retiré de toute la plateforme !" });
    } catch (err) {
        console.error("❌ Erreur lors de la suppression du produit :", err);
        res.status(500).json({ success: false, message: "Erreur serveur lors de la suppression." });
    }
});
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});
// 5. Lancement du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port : ${PORT}`);
});