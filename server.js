require('dotenv').config();
const mongoose = require('mongoose');
const path = require('path'); 
const express = require('express');

const app = express();
const PORT = 3000;

// Middleware configuration
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Connexion sécurisée à MongoDB
const dbUser = "yambodauphin" + "_db_user";
const dbPass = "YAMBO1971";
const dbHosts = "ac-amin2dr-shard-00-00.432sx7q.mongodb.net:27017,ac-amin2dr-shard-00-01.432sx7q.mongodb.net:27017,ac-amin2dr-shard-00-02.432sx7q.mongodb.net:27017/?ssl=true&replicaSet=atlas-j6zw0m-shard-0&authSource=admin&appName=Cluster0";
const cleanURI = `mongodb://${dbUser}:${dbPass}@${dbHosts}`;

mongoose.connect(cleanURI)
  .then(() => console.log('✅ Connexion à MongoDB réussie !'))
  .catch(err => console.error('❌ Erreur de connexion MongoDB : ', err));

// Stockage temporaire pour les sessions actives (Simule un gestionnaire de session)
const sessionsActives = {};

// =========================================================
// MODÈLES MONGOOSE
// =========================================================

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
    vendedor: { type: String, default: "vendeur@test.com" },
    valide: { type: Boolean, default: true }
});
const Produit = mongoose.models.Produit || mongoose.model('Produit', produitSchema);

const utilisateurSchema = new mongoose.Schema({
    nom: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    boutiqueCreee: { type: Boolean, default: false },
    vendeurNom: { type: String, default: "" },
    boutiqueNom: { type: String, default: "" },
    vendeurTelephone: { type: String, default: "" },
    vendeurPays: { type: String, default: "Congo (RDC)" },
    vendeurVille: { type: String, default: "" },
    vendeurPin: { type: String, default: "" },
    paiementTitulaire: { type: String, default: "" },
    paiementReseau: { type: String, default: null },
    paiementNumero: { type: String, default: null },
    paiementBanqueNom: { type: String, default: null },
    paiementIban: { type: String, default: null },
    paiementSwift: { type: String, default: null },
    paiementPaypalEmail: { type: String, default: null }
});
const Utilisateur = mongoose.models.Utilisateur || mongoose.model('Utilisateur', utilisateurSchema);

// ==========================================
// ROUTES AUTHENTIFICATION (CORRIGÉES)
// ==========================================

// Inscription standard client unifiée sur MongoDB
app.post('/api/inscription', async (req, res) => {
    try {
        const { nom, email, mdp } = req.body; 

        if (!nom || !email || !mdp) {
            return res.status(400).json({ success: false, message: "Tous les champs sont obligatoires." });
        }

        const utilisateurExiste = await Utilisateur.findOne({ email });
        if (utilisateurExiste) {
            return res.status(400).json({ success: false, message: "Cet e-mail est déjà utilisé." });
        }

        await Utilisateur.create({
            nom: nom,
            email: email,
            password: mdp,
            boutiqueCreee: false
        });

        console.log(`👤 Nouvel utilisateur inscrit dans MongoDB : ${nom}`);
        res.json({ success: true, message: `Compte créé avec succès pour ${nom} !` });
    } catch (err) {
        console.error("❌ Erreur lors de l'inscription :", err);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    }
});

app.post('/api/connexion', async (req, res) => {
    const { email, mdp } = req.body;
    try {
        const user = await Utilisateur.findOne({ email: email, password: mdp });

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

app.post('/api/vendeur/statut', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.json({ connecte: false, aUneBoutique: false, estVerrouille: true });
        }

        const user = await Utilisateur.findOne({ email: email });
        if (!user) {
            return res.json({ connecte: false, aUneBoutique: false, estVerrouille: true });
        }

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
        const results = await Produit.find({});
        res.json(results); 
    } catch (err) {
        console.error("❌ Erreur MongoDB lors de la récupération des produits :", err);
        return res.status(500).json({ error: "Impossible de charger les produits." });
    }
});

app.post('/api/produits', async (req, res) => {
    try {
        const nouveauProduit = new Produit(req.body);
        await nouveauProduit.save();
        console.log(`📦 Nouveau produit publié en ligne : ${req.body.nom}`);
        res.status(201).json({ success: true, message: "Produit publié avec succès !" });
    } catch (err) {
        console.error("❌ Erreur lors de la publication du produit :", err);
        res.status(500).json({ error: "Impossible de publier le produit." });
    }
});

app.post('/api/commande/valider', async (req, res) => {
    const { items } = req.body;
    if (!items || items.length === 0) {
        return res.status(400).json({ success: false, message: "Le panier est vide." });
    }
    try {
        for (const item of items) {
            await Produit.findByIdAndUpdate(item.id, {
                $inc: { stock: -item.qty } 
            });
        }
        console.log("📦 Une commande a été validée et les stocks mis à jour dans MongoDB !");
        res.json({ success: true, message: "Commande enregistrée avec succès !" });
    } catch (err) {
        console.error(`❌ Erreur de mise à jour des stocks :`, err);
        return res.status(500).json({ success: false, message: "Erreur lors de la mise à jour des stocks." });
    }
});

app.delete('/api/produits/:id', async (req, res) => {
    try {
        const produitId = req.params.id;
        const resultat = await Produit.deleteOne({ _id: produitId });
        
        if (resultat.deletedCount === 0) {
            return res.status(404).json({ success: false, message: "Produit introuvable." });
        }
        res.json({ success: true, message: "Le produit a été retiré !" });
    } catch (err) {
        console.error("❌ Erreur lors de la suppression du produit :", err);
        res.status(500).json({ success: false, message: "Erreur serveur." });
    }
});

// =========================================================================
// INSCRIPTION VENDEUR INTERNATIONALE (CORRIGÉE AVEC PIN)
// =========================================================================
app.post('/api/vendeurs/inscription', async (req, res) => {
    try {
        const { 
            nom, email, password, estVendeur,
            nomBoutique, telephone, pays, ville, vendeurPin,
            titulaireCompte, reseauMobileMoney, numeroMobileMoney,
            nomBanque, iban, swift, paypalEmail
        } = req.body;

        if (!nom || !email || !password) {
            return res.status(400).json({ success: false, message: "Données de compte obligatoires manquantes." });
        }

        const utilisateurExiste = await Utilisateur.findOne({ email });
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
            if (!nomBoutique || !telephone || !ville || !vendedorPin) {
                return res.status(400).json({ success: false, message: "Veuillez remplir toutes les informations ainsi que le code PIN." });
            }
            
            nouvelUtilisateur.boutiqueCreee = true;
            nouvelUtilisateur.vendeurNom = nom;
            nouvelUtilisateur.boutiqueNom = nomBoutique;
            nouvelUtilisateur.vendeurTelephone = telephone;
            nouvelUtilisateur.vendeurPays = pays || "Congo (RDC)";
            nouvelUtilisateur.vendeurVille = ville;
            nouvelUtilisateur.vendeurPin = vendeurPin; // Enregistrement du PIN réparé !
            
            nouvelUtilisateur.paiementTitulaire = titulaireCompte || nom;
            nouvelUtilisateur.paiementReseau = reseauMobileMoney || null;
            nouvelUtilisateur.paiementNumero = numeroMobileMoney || null;
            nouvelUtilisateur.paiementBanqueNom = nomBanque || null;
            nouvelUtilisateur.paiementIban = iban || null;
            nouvelUtilisateur.paiementSwift = swift || null;
            nouvelUtilisateur.paiementPaypalEmail = paypalEmail || null;
        }

        await Utilisateur.create(nouvelUtilisateur);

        return res.json({ 
            success: true, 
            message: estVendeur ? "🚀 Votre boutique a été créée avec succès !" : "Compte client créé avec succès !" 
        });

    } catch (error) {
        console.error("Erreur inscription complète :", error);
        return res.status(500).json({ success: false, message: "Erreur lors de la création du profil." });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port : ${PORT}`);
});