// Crée les tables et le trigger (idempotent)

require('dotenv').config();
const pool = require('./db');

const sqlUtilisateurs = `
    CREATE TABLE IF NOT EXISTS utilisateurs (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100) NOT NULL,
        prenom VARCHAR(100) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        telephone VARCHAR(30),
        adresse TEXT, -- adresse libre (ligne adresse, code postal, ville ...)
    -- mot_de_passe nullable so managers can create users without password
        mot_de_passe VARCHAR(255),
        role VARCHAR(20) NOT NULL DEFAULT 'client' CHECK (role IN ('utilisateur','administrateur')),
        date_creation TIMESTAMPTZ DEFAULT now()
        );
`;

const sqlPaniers = `
    CREATE TABLE IF NOT EXISTS paniers_fidelite (
        id SERIAL PRIMARY KEY,
        utilisateur_id INTEGER NOT NULL REFERENCES utilisateurs(id) ON DELETE CASCADE,
        date_ouverture DATE NOT NULL DEFAULT CURRENT_DATE,
        date_expiration DATE, -- maintained by trigger: last_utilisation + 1 year
        points INTEGER NOT NULL DEFAULT 0,
        date_maj TIMESTAMPTZ DEFAULT now(),
        actif BOOLEAN DEFAULT true,
        last_utilisation DATE,
        date_desactivation TIMESTAMPTZ,
        raison_desactivation VARCHAR(100),
        supprime BOOLEAN DEFAULT false,
        numero_carte VARCHAR(64) -- printed card number provided by store
        );
`;

// transactions table for audit (optional but recommended)
const sqlTransactions = `
    CREATE TABLE IF NOT EXISTS points_transactions (
        id SERIAL PRIMARY KEY,
        panier_id INTEGER NOT NULL REFERENCES paniers_fidelite(id) ON DELETE CASCADE,
        type VARCHAR(10) NOT NULL CHECK (type IN ('credit','debit','transfer')),
        montant INTEGER NOT NULL, -- positive credit, negative debit
        motif VARCHAR(255),
        date_creation TIMESTAMPTZ DEFAULT now(),
        annee INTEGER NOT NULL
        );
    CREATE INDEX IF NOT EXISTS idx_pts_panier_annee ON points_transactions(panier_id, annee);
`;

// Indexes: unique cart number and one active card per user (partial unique index)
const sqlIndexes = `
-- unique printed card number (allows many NULLs)
CREATE UNIQUE INDEX IF NOT EXISTS ux_paniers_numero_carte ON paniers_fidelite(numero_carte);

-- enforce <=1 active card per user
CREATE UNIQUE INDEX IF NOT EXISTS idx_un_panier_actif_par_utilisateur
  ON paniers_fidelite(utilisateur_id)
  WHERE actif = true AND supprime = false;
`;

// remplacez sqlTriggerFunction et sqlCreateTrigger par ces deux variables (ou injetez ce SQL dans la séquence d'exécution)
const sqlTriggerFunction_idempotent = `
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE p.proname = 'maj_date_expiration_par_utilisation'
      AND n.nspname = 'public'
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.maj_date_expiration_par_utilisation()
      RETURNS TRIGGER AS $body$
    BEGIN
      IF (TG_OP = 'INSERT') THEN
        IF NEW.last_utilisation IS NULL THEN
          NEW.last_utilisation := NEW.date_ouverture;
        END IF;
        NEW.date_expiration := (NEW.last_utilisation + INTERVAL '1 year')::date;
        RETURN NEW;
      END IF;

      IF (TG_OP = 'UPDATE') THEN
        IF NEW.last_utilisation IS DISTINCT FROM OLD.last_utilisation THEN
          NEW.date_expiration := (NEW.last_utilisation + INTERVAL '1 year')::date;
        END IF;
        RETURN NEW;
      END IF;

      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql;
    $fn$;
  END IF;
END;
$$ LANGUAGE plpgsql;
`;

const sqlCreateTrigger_idempotent = `
DROP TRIGGER IF EXISTS trg_maj_date_expiration ON paniers_fidelite;
CREATE TRIGGER trg_maj_date_expiration
BEFORE INSERT OR UPDATE ON paniers_fidelite
FOR EACH ROW
EXECUTE FUNCTION maj_date_expiration_par_utilisation();
`;


(async () => {
    const client = await pool.connect();
    try {
        console.log('Début création des tables et objets (création complète)...');
        await client.query('BEGIN');

        await client.query(sqlUtilisateurs);
        await client.query(sqlPaniers);
        await client.query(sqlTransactions);
        await client.query(sqlTriggerFunction_idempotent);
        await client.query(sqlCreateTrigger_idempotent);

        // create indexes (ok inside transaction for small DBs)
        await client.query(sqlIndexes);

        await client.query('COMMIT');
        console.log('Terminé : tables, trigger et indexes créés (ou déjà existants).');
        console.log('- `utilisateurs` inclut maintenant le champ `adresse` (texte libre).');
        console.log('- `paniers_fidelite` avec `numero_carte` (printed card number).');
        console.log('- index partiel pour au plus un panier actif par utilisateur.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Erreur lors de la création :', err.message || err);
        process.exitCode = 1;
    } finally {
        client.release();
    }
})();
