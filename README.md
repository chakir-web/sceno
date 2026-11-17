# SCENO

Maison d'objets pour le marché marocain. Boutique, commandes en paiement à la livraison, espace administrateur et espace confirmateur. La livraison est confiée à un transporteur externe : il n'existe aucun espace livreur.

## Démarrage

```bash
npm install
npm run dev
```

La boutique s'ouvre sur `http://localhost:3000`. Tant que Supabase n'est pas renseigné, les pages s'affichent et indiquent précisément la configuration manquante. Aucun catalogue n'est simulé.

## Configuration Supabase

1. Créer un projet sur [supabase.com](https://supabase.com).
2. Dans le SQL Editor, exécuter dans l'ordre :
   - `supabase/migrations/20261116120000_init.sql`
   - `supabase/migrations/20261116123000_audit_helper.sql`
   - `supabase/seed.sql` seulement pour les données de démonstration
3. Copier `.env.example` vers `.env.local` et renseigner :

| Variable | Où la trouver |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Settings → API → anon public |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings → API → service_role. Serveur uniquement. |
| `SCENO_SETUP_TOKEN` | Une longue valeur aléatoire choisie par vous |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` en local |

4. Dans Authentication → URL Configuration, ajouter `http://localhost:3000/auth/callback`.
5. Redémarrer `npm run dev`, ouvrir `/auth/login` et créer le premier administrateur. Cette étape n'est possible qu'une fois, tant qu'aucun admin n'existe.
6. Depuis l'administration, créer les comptes confirmateurs. Les rôles ne peuvent pas être choisis par le navigateur.

Les tarifs, le téléphone et l'adresse du seed sont des valeurs de démonstration à remplacer dans Paramètres.

## Ce qui n'est pas connecté

Aucune API de transporteur n'est appelée. Les expéditions se gèrent dans **Administration → Expéditions externes** : sélection, export CSV, numéro de suivi, frais transporteur et import CSV. Le contrat `ShippingProvider` dans `src/lib/shipping/provider.ts` est l'emplacement prévu pour une future API réelle.

## Vérification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Règles métier utiles

- Les prix et le stock sont recalculés dans PostgreSQL à la création de commande. Le navigateur ne peut pas imposer un montant.
- Une commande créée n'est pas un encaissement. L'encaissé correspond au passage au statut livré.
- Le stock est rétabli lors d'une annulation avant expédition, d'un refus ou d'un retour.
- Un confirmateur ne voit que les commandes qui lui sont attribuées.
- Le suivi public exige le numéro de commande et le téléphone associé, avec une limite de tentatives.
