
import express from 'express';
import fs from 'fs';
import path from 'path';
import pokemon from './schema/pokemon.js';

import './connect.js';

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));

const allowedMimeTypes = ['image/png', 'image/jpeg', 'image/webp'];
const mimeToExtension = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp'
};

// Servir les fichiers statiques du dossier assets
app.use('/assets', express.static('assets'));

// CORS middleware - pour accepter les requêtes du frontend
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Routes

// POST - Upload image pokemon (base64 JSON)
app.post('/upload/pokemon/:id', (req, res) => {
    const { imageBase64, mimeType, dataUrl } = req.body || {};

    let effectiveMimeType = mimeType;
    let base64Payload = imageBase64;

    if (dataUrl && typeof dataUrl === 'string' && dataUrl.startsWith('data:')) {
        const match = dataUrl.match(/^data:(image\/(png|jpeg|webp));base64,(.+)$/);
        if (!match) {
            return res.status(400).json({ error: 'Invalid data URL format' });
        }
        effectiveMimeType = match[1];
        base64Payload = match[3];
    }

    if (!base64Payload || !effectiveMimeType) {
        return res.status(400).json({ error: 'imageBase64 and mimeType are required' });
    }

    if (!allowedMimeTypes.includes(effectiveMimeType)) {
        return res.status(400).json({ error: 'Only image/png, image/jpeg, image/webp are allowed' });
    }

    const extension = mimeToExtension[effectiveMimeType];
    const fileName = `${req.params.id}.${extension}`;
    const outputDir = path.join(process.cwd(), 'assets', 'pokemons');
    const outputPath = path.join(outputDir, fileName);

    try {
        fs.mkdirSync(outputDir, { recursive: true });
        const buffer = Buffer.from(base64Payload, 'base64');
        fs.writeFileSync(outputPath, buffer);
    } catch (error) {
        return res.status(500).json({ error: 'Failed to save image' });
    }

    const url = `${req.protocol}://${req.get('host')}/assets/pokemons/${fileName}`;
    return res.json({ url });
});

// GET - Page d'accueil
app.get('/', (req, res) => {
  res.send('Bienvenue sur le serveur Pokemon!');
});

// GET - Tous les pokemons
app.get('/pokemons', async (req, res) => {
    try {
        const totalPokemons = await pokemon.countDocuments();
        const pokemons = await pokemon.find({});

        res.json({
            pokemons,
            totalPokemons
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Rechercher un pokemon par nom (toutes les langues)
app.get('/pokemons/search/:name', async (req, res) => {
    try {
        const name = req.params.name;
        const poke = await pokemon.findOne({
            $or: [
                { 'name.english': { $regex: name, $options: 'i' } },
                { 'name.japanese': { $regex: name, $options: 'i' } },
                { 'name.chinese': { $regex: name, $options: 'i' } },
                { 'name.french': { $regex: name, $options: 'i' } }
            ]
        });
        
        if (poke) {
            res.json(poke);
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET - Un pokemon par ID
app.get('/pokemons/:id', async (req, res) => {
    try {
        const poke = await pokemon.findOne({ id: req.params.id });
        if (poke) {
            res.json(poke);
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST - Créer un nouveau pokemon
app.post('/pokemons', async (req, res) => {
    try {
        const newPokemon = new pokemon(req.body);
        const result = await newPokemon.save();
        res.status(201).json({
            message: 'Pokemon created successfully',
            pokemon: result
        });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// PUT - Modifier un pokemon (par ID)
app.put('/pokemon/:id', async (req, res) => {
    try {
        const poke = await pokemon.findOneAndUpdate(
            { id: req.params.id },
            req.body,
            { new: true, runValidators: true }
        );
        
        if (poke) {
            res.json({
                message: 'Pokemon updated successfully',
                pokemon: poke
            });
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

// DELETE - Supprimer un pokemon (par ID)
app.delete('/pokemon/:id', async (req, res) => {
    try {
        const poke = await pokemon.findOneAndDelete({ id: req.params.id });
        
        if (poke) {
            res.json({
                message: 'Pokemon deleted successfully',
                pokemon: poke
            });
        } else {
            res.status(404).json({ error: 'Pokemon not found' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});