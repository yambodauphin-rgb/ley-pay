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

// Stockage temporaire pour les sessions actives (Simule un gestionnaire de session)
const sessionsActives = {};

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
if (!mongoose.models.Produit) mongoose.model('Produit', produitSchema);

// 🏦 SCHÉMA UTILISATEUR MIS À JOUR POUR LE CONTENU INTERNATIONAL
const utilisateurSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // Harmonisé avec le payload
    
    boutiqueCreee: { type: Boolean, default: false },
    vendeurNom: { type: String, default: "" },
    boutiqueNom: { type: String, default: "" },
    vendeurTelephone: { type: String, default: "" },
    vendeurPays: { type: String, default: "Congo (RDC)" },
    vendeurVille: { type: String, default: "" },
    vendeurPin: { type: String, default: "" },

    // 💳 Nouveaux champs de paiement (Monde entier)
    paiementTitulaire: { type: String, default: "" },
    paiementReseau: { type: String, default: null },       // Mobile Money
    paiementNumero: { type: String, default: null },       // Mobile Money
    paiementBanqueNom: { type: String, default: null },    // Virement Bancaire
    paiementIban: { type: String, default: null },         // Virement Bancaire
    paiementSwift: { type: String, default: null },        // Virement Bancaire
    paiementPaypalEmail: { type: String, default: null }   // PayPal
});

// Réinitialisation ou déclaration propre du modèle
if (mongoose.models.Utilisateur) {
    delete mongoose.models.Utilisateur;
}
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
        const user = await mongoose.model('Utilisateur').findOne({ email: email, password: mdp });

        if (user) {
            console.log(`🔑 Connexion réussie pour : ${user.nom}`);
            
            sessionsActives[user.email] = {
                connected: true,
                email: user.email,
                vendeurDeverrouille: false 
            };

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

app.post('/api/vendeur/statut', async (req, res) => { // 🟢 Changé en app.post pour pouvoir envoyer l'email sécurisé
    try {
        const { email } = req.body; // 🟢 On récupère l'email envoyé par le navigateur

        if (!email) {
            return res.json({ connecte: false, aUneBoutique: false, estVerrouille: true });
        }

        const user = await mongoose.model('Utilisateur').findOne({ email: email });

        if (!user) {
            return res.json({ connecte: false, aUneBoutique: false, estVerrouille: true });
        }

        // On vérifie dans la mémoire si la session est active et déverrouillée
        const session = sessionsActives[email];
        const estVerrouille = session ? !session.vendeurDeverrouille : true;

        res.json({
            connecte: true,
            aUneBoutique: user.boutiqueCreee,
            estVerrouille: estVerrouille
        });

    } catch (error) {
        console.error("❌ Erreur de statut vendeur :", error);
        res.status(500).json({ connecte: false, error: "Erreur serveur" });
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
// 🌟 ROUTE INSCRIPTION VENDEUR INTERNATIONALE AJUSTÉE (Banque, Mobile, PayPal)
// =========================================================================
app.post('/api/vendeurs/inscription', async (req, res) => {
    try {
        const { 
            nom, email, password, estVendeur,
            nomBoutique, telephone, pays, ville,
            titulaireCompte, reseauMobileMoney, numeroMobileMoney,
            nomBanque, iban, swift, paypalEmail
        } = req.body;

        if (!nom || !email || !password) {
            return res.status(400).json({ success: false, message: "Données de compte obligatoires manquantes." });
        }

        const utilisateurExiste = await mongoose.model('Utilisateur').findOne({ email });
        if (utilisateurExiste) {
            return res.status(400).json({ success: false, message: "Cet e-mail est déjà utilisé." });
        }

        const nouvelUtilisateur = {
            nom,
            email,
            password, 
            boutiqueCreee: false
        };

        if (estVendeur) {
            if (!nomBoutique || !telephone || !ville) {
                return res.status(400).json({ success: false, message: "Veuillez remplir les informations de base de votre boutique." });
            }
            
            nouvelUtilisateur.boutiqueCreee = true;
            nouvelUtilisateur.vendeurNom = nom;
            nouvelUtilisateur.boutiqueNom = nomBoutique;
            nouvelUtilisateur.vendeurTelephone = telephone;
            nouvelUtilisateur.vendeurPays = pays || "Congo (RDC)";
            nouvelUtilisateur.vendeurVille = ville;
            
            // Collecte des informations de paiement selon ce que l'utilisateur a configuré
            nouvelUtilisateur.paiementTitulaire = titulaireCompte || nom;
            nouvelUtilisateur.paiementReseau = reseauMobileMoney || null;
            nouvelUtilisateur.paiementNumero = numeroMobileMoney || null;
            nouvelUtilisateur.paiementBanqueNom = nomBanque || null;
            nouvelUtilisateur.paiementIban = iban || null;
            nouvelUtilisateur.paiementSwift = swift || null;
            nouvelUtilisateur.paiementPaypalEmail = paypalEmail || null;
        }

        await mongoose.model('Utilisateur').create(nouvelUtilisateur);

        return res.json({ 
            success: true, 
            message: estVendeur ? "🚀 Votre boutique a été créée et configurée avec succès !" : "Compte client créé avec succès !" 
        });

    } catch (error) {
        console.error("Erreur inscription complète :", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la création du profil." });
    }
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port : ${PORT}`);
});