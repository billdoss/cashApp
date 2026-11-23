/* Couche de stockage. Aujourd'hui : tout reste sur le téléphone (coffre chiffré d'Auth).
   Plus tard : un adaptateur Supabase se branchera ici sans toucher à l'interface.

   Un adaptateur expose :
     save(state)  -> Promise   enregistre l'état complet
   Le chargement initial passe par Auth.unlock(), qui déchiffre le coffre local.

   Pour la synchronisation, chaque enregistrement ajoute `updatedAt` (ms) à l'état.
   Les dépenses, budgets et objectifs ont déjà un identifiant stable (`id`), ce qui
   permettra de fusionner avec le serveur sans doublons. */
const LocalAdapter = {
  name: "local",
  save: state => Auth.write(state)
};

const Store = {
  adapter: LocalAdapter,
  save(state) { state.updatedAt = Date.now(); return this.adapter.save(state); }
};
