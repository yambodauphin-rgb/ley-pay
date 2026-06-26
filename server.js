require('dotenv').config();
const mongoose = require('mongoose');

// On garde l'astuce de découpage pour bloquer l'injecteur automatique de ton terminal
const dbUser = "yambodauphin" + "_db_user";
const dbPass = "YAMBO1971";
const dbHosts = "ac-amin2dr-shard-00-00.432sx7q.mongodb.net:27017,ac-amin2dr-shard-00-01.432sx7q.mongodb.net:27017,ac-amin2dr-shard-00-02.432sx7q.mongodb.net:27017/?ssl=true&replicaSet=atlas-j6zw0m-shard-0&authSource=admin&appName=Cluster0";

const cleanURI = `mongodb://${dbUser}:${dbPass}@${dbHosts}`;

mongoose.connect(cleanURI)
  .then(() => console.log('✅ Connexion à MongoDB réussie !'))
  .catch(err => console.error('❌ Erreur de connexion MongoDB : ', err));

// Stockage temporaire en mémoire pour les codes SMS (OTP)
const codesVerificationSMS = {};

// =========================================================
// 1. DÉFINITION DES SCHÉMAS ET MODÈLES MONGOOSE
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
mongoose.model('Produit', produitSchema);

// Schéma pour les Utilisateurs (Mis à jour avec les champs Vendeur)
const utilisateurSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    motDePasse: { type: String, required: true },
    
    // Nouveaux champs pour la gestion Ley Pay Business
    boutiqueCreee: { type: Boolean, default: false },
    vendeurNom: { type: String, default: "" },
    boutiqueNom: { type: String, default: "" },
    vendeurTelephone: { type: String, default: "" },
    vendeurVille: { type: String, default: "" },
    vendeurPin: { type: String, default: "" }
});
mongoose.model('Utilisateur', utilisateurSchema);

// =========================================================

const path = require('path'); 
const express = require('express');
const app = express();
const PORT = 3000;

// Middleware configuration
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// ROUTES AUTHENTIFICATION DE BASE
// ==========================================

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

app.post('/api/connexion', async (req, res) => {
    const { email, mdp } = req.body;

    try {
        const user = await mongoose.model('Utilisateur').findOne({ email: email, motDePasse: mdp });

        if (user) {
            console.log(`🔑 Connexion réussie pour : ${user.nom}`);
            res.json({ 
                success: true, 
                message: `Bienvenue ${user.nom} !`, 
                user: { 
                    nom: user.nom, 
                    email: user.email,
                    boutiqueCreee: user.boutiqueCreee,
                    vendeurPin: user.vendeurPin
                } 
            });
        } else {
            res.status(401).json({ success: false, message: "Adresse e-mail ou mot de passe incorrect." });
        }
    } catch (err) {
        console.error("❌ Erreur MongoDB lors de la connexion :", err);
        return res.status(500).json({ success: false, message: "Erreur serveur." });
    }
});

// ==========================================
// ROUTES GESTION DES PRODUITS & COMMANDES
// ==========================================

app.get('/api/produits', async (req, res) => {
    try {
        const results = await mongoose.model('Produit').find({});
        res.json(results); 
    } catch (err) {
        console.error("❌ Erreur MongoDB lors de la récupération des produits :", err);
        return res.status(500).json({ error: "Impossible de charger les produits." });
    }
});

app.post('/api/produits', async (req, res) => {
    try {
        const ProduitModel = mongoose.model('Produit');
        const nouveauProduit = new ProduitModel(req.body);
        await nouveauProduit.save();
        
        console.log(`📦 Nouveau produit publié en ligne : ${req.body.nom}`);
        res.status(201).json({ success: true, message: "Produit publié avec succès !" });
    } catch (err) {
        console.error("❌ Erreur lors de la publication du produit :", err);
        res.status(500).json({ error: "Impossible de publier le produit sur la plateforme." });
    }
});

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

app.delete('/api/produits/:id', async (req, res) => {
    try {
        const produitId = req.params.id;
        const MonModeleProduit = mongoose.models.Produit || mongoose.model('Produit');
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

// =========================================================================
// 🆕 NOUVELLES ROUTES : INSCRIPTION VENDEUR RAPIDE & VÉRIFICATION SMS (OTP)
// =========================================================================

// Route 1 : Demande d'inscription et génération du code secret SMS
app.post('/api/vendeurs/inscription', async (req, res) => {
    try {
        const { nom, boutiqueNom, telephone, ville, vendeurPin, email } = req.body;

        if (!email || !telephone) {
            return res.status(400).json({ success: false, message: "Certaines données requises sont manquantes." });
        }

        // Génération d'un code OTP à 4 chiffres
        const codeOTP = Math.floor(1000 + Math.random() * 9000).toString();

        // Sauvegarde temporaire en mémoire
        codesVerificationSMS[email] = {
            code: codeOTP,
            donnees: { nom, boutiqueNom, telephone, ville, vendeurPin },
            expireAt: Date.now() + 10 * 60 * 1000 // Validité de 10 minutes
        };

        // 👀 Regarde tes logs dans ton terminal Render / Local pour voir le code s'afficher !
        console.log(`\n📱 [SMS LEY PAY] Code envoyé à ${telephone} : -> ${codeOTP} <-\n`);

        return res.json({ success: true, message: "Code de validation généré avec succès." });
    } catch (error) {
        console.error("❌ Erreur lors de l'initiation de la boutique :", error);
        return res.status(500).json({ success: false, message: "Erreur interne du serveur." });
    }
});

// Route 2 : Validation finale du code entré par l'utilisateur
app.post('/api/vendeurs/verifier-sms', async (req, res) => {
    try {
        const { email, code } = req.body;
        const sessionVerif = codesVerificationSMS[email];

        if (!sessionVerif || sessionVerif.code !== code.trim()) {
            return res.status(400).json({ success: false, message: "Le code de vérification est incorrect." });
        }

        if (Date.now() > sessionVerif.expireAt) {
            delete codesVerificationSMS[email];
            return res.status(400).json({ success: false, message: "Le code de vérification a expiré." });
        }

        // Le code est validé ! On extrait les données sauvegardées
        const { nom, boutiqueNom, telephone, ville, vendeurPin } = sessionVerif.donnees;
        const UtilisateurModel = mongoose.model('Utilisateur');

        // Mise à jour de l'utilisateur dans MongoDB Atlas
        await UtilisateurModel.updateOne(
            { email: email },
            {
                $set: {
                    boutiqueCreee: true,
                    vendeurNom: nom,
                    boutiqueNom: boutiqueNom,
                    vendeurTelephone: telephone,
                    vendeurVille: ville,
                    vendeurPin: vendeurPin
                }
            }
        );

        // Nettoyage de la mémoire temporaire
        delete codesVerificationSMS[email];

        console.log(`🎉 Boutique active avec succès dans MongoDB pour l'utilisateur : ${email}`);
        return res.json({ success: true, message: "Votre espace vendeur a été créé et activé !" });
    } catch (error) {
        console.error("❌ Erreur lors de la validation du code OTP :", error);
        return res.status(500).json({ success: false, message: "Erreur serveur lors de la validation." });
    }
});

// ==========================================
// ROUTE PAR DÉFAUT (FALLBACK FRONTEND)
// ==========================================
app.use((req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port : ${PORT}`);
});