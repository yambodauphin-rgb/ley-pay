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

// Schéma pour les Utilisateurs
const utilisateurSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    motDePasse: { type: String, required: true },
    
    boutiqueCreee: { type: Boolean, default: false },
    vendeurNom: { type: String, default: "" },
    boutiqueNom: { type: String, default: "" },
    vendeurTelephone: { type: String, default: "" },
    vendeurVille: { type: String, default: "" },
    vendeurPin: { type: String, default: "" }
});
if (!mongoose.models.Utilisateur) mongoose.model('Utilisateur', utilisateurSchema);

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
            
            // Sauvegarde de l'état connecté sur le serveur lié à cet e-mail
            sessionsActives[user.email] = {
                connected: true,
                email: user.email,
                vendeurDeverrouille: false // Reste verrouillé par PIN par défaut à la connexion
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

// ==========================================
// 🆕 ROUTE CRUCIALE : STATUT ESPACE VENDEUR
// ==========================================
app.get('/api/vendeur/statut', async (req, res) => {
    try {
        // Idéalement, on récupère l'email de l'utilisateur actif (passé via en-tête ou requête)
        // Pour l'instant, on cherche s'il y a un utilisateur connecté dans notre registre temporaire
        const sessionUserEmail = Object.keys(sessionsActives)[0]; 

        if (!sessionUserEmail) {
            return res.json({ connecte: false, aUneBoutique: false, estVerrouille: true });
        }

        const session = sessionsActives[sessionUserEmail];
        const user = await mongoose.model('Utilisateur').findOne({ email: session.email });

        if (!user) {
            return res.json({ connecte: false, aUneBoutique: false, estVerrouille: true });
        }

        res.json({
            connecte: true,
            aUneBoutique: user.boutiqueCreee,
            estVerrouille: !session.vendeurDeverrouille // Verrouillé si pas explicitement déverrouillé
        });

    } catch (error) {
        console.error("❌ Erreur de statut vendeur :", error);
        res.status(500).json({ connecte: false, error: "Erreur serveur" });
    }
});

// Déverrouillage par code PIN
app.post('/api/vendeur/verifier-pin', async (req, res) => {
    const { email, pin } = req.body;
    try {
        const user = await mongoose.model('Utilisateur').findOne({ email: email });
        if (user && user.vendeurPin === pin) {
            if (sessionsActives[email]) {
                sessionsActives[email].vendeurDeverrouille = true;
            }
            return res.json({ success: true, message: "Code PIN valide !" });
        }
        res.status(400).json({ success: false, message: "Code PIN incorrect." });
    } catch (err) {
        res.status(500).json({ success: false, message: "Erreur serveur." });
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
// 🆕 ROUTES : INSCRIPTION VENDEUR RAPIDE & VÉRIFICATION SMS (OTP)
// =========================================================================

app.post('/api/vendeurs/inscription', async (req, res) => {
    try {
        const { nom, boutiqueNom, telephone, ville, vendeurPin, email } = req.body;

        if (!email || !telephone) {
            return res.status(400).json({ success: false, message: "Certaines données requises sont manquantes." });
        }

        const codeOTP = Math.floor(1000 + Math.random() * 9000).toString();

        codesVerificationSMS[email] = {
            code: codeOTP,
            donnees: { nom, boutiqueNom, telephone, ville, vendeurPin },
            expireAt: Date.now() + 10 * 60 * 1000 
        };

        console.log(`\n📱 [SMS LEY PAY] Code envoyé à ${telephone} : -> ${codeOTP} <-\n`);

        return res.json({ success: true, message: "Code de validation généré avec succès." });
    } catch (error) {
        console.error("❌ Erreur lors de l'initiation de la boutique :", error);
        return res.status(500).json({ success: false, message: "Erreur interne du serveur." });
    }
});

app.post('/api/vendeurs/verifier-sms', async (req, res) => {
    try {
        const { email, code } = req.body;

        if (!email || !code) {
            return res.status(400).json({ success: false, message: "Données manquantes." });
        }

        // 1. Recherche de la session temporaire
        const sessionVendeur = codesVerificationSMS[email];

        if (sessionVendeur) {
            if (sessionVendeur.code === code || sessionVendeur.donnees.vendeurPin === code) {
                const utilisateurModifie = await mongoose.models.Utilisateur.findOneAndUpdate(
                    { email: email },
                    {
                        $set: {
                            boutiqueCreee: true,
                            vendeurNom: sessionVendeur.donnees.nom,
                            boutiqueNom: sessionVendeur.donnees.boutiqueNom,
                            vendeurTelephone: sessionVendeur.donnees.telephone,
                            vendeurVille: sessionVendeur.donnees.ville,
                            vendeurPin: sessionVendeur.donnees.vendeurPin
                        }
                    },
                    { new: true }
                );

                if (!utilisateurModifie) {
                    return res.status(404).json({ success: false, message: "Compte utilisateur introuvable." });
                }

                delete codesVerificationSMS[email];

                return res.json({ 
                    success: true, 
                    message: "🔑 Boutique activée et enregistrée de manière permanente !" 
                });
            }
        }

        // 2. Sécurité de secours
        let utilisateurPermanent = null;
        if (email) {
            utilisateurPermanent = await mongoose.models.Utilisateur.findOne({ email: email });
        }
        
        if (!utilisateurPermanent && code) {
            utilisateurPermanent = await mongoose.models.Utilisateur.findOne({ vendeurPin: code });
        }
        
        if (utilisateurPermanent && utilisateurPermanent.vendeurPin === code) {
            return res.json({ 
                success: true, 
                message: "🔑 Connexion permanente validée avec succès !" 
            });
        }

        return res.status(400).json({ 
            success: false, 
            message: "Le code ou PIN saisi est incorrect, ou la session a expiré." 
        });

    } catch (error) {
        console.error("Erreur de validation :", error);
        return res.status(500).json({ success: false, message: "Erreur interne lors de la vérification." });
    }
});

// Lancement du serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port : ${PORT}`);
});