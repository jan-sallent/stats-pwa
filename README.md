# Handbol Stats PWA

Aplicació web instal·lable per registrar dades de partits d'handbol al dispositiu i
exportar-les en format CSV.

## Arquitectura

- `src/screens`: pantalles i interacció amb l'usuari.
- `src/models`: tipus del domini, independents de la interfície.
- `src/db`: base de dades local IndexedDB mitjançant Dexie.
- `src/export`: generació i descàrrega de fitxers CSV.
- `src/styles`: estils globals pensats primer per a mòbil.
- `src/app.ts`: navegació i composició de l'aplicació.

## Ordres de desenvolupament

```powershell
npm install
npm run dev
npm run build
npm run preview
```

## Estat

- Fase 2: estructura modular i carcassa de navegaci&oacute; m&ograve;bil.
- Fase 3: manifest, service worker, actualitzacions i funcionament offline.
- Fase 4: IndexedDB connectada a la interf&iacute;cie, creaci&oacute; de partits esborrany,
  recuperaci&oacute; de l'&uacute;ltim partit i petici&oacute; d'emmagatzematge persistent.
- Fase 5: formulari del partit, sessi&oacute; atac/defensa, registre d'accions i dorsals,
  canvi de part, desfer, finalitzaci&oacute; i historial local.
- Fase 6: exportaci&oacute; CSV individual i conjunta, UTF-8 compatible amb Excel i
  desc&agrave;rrega directa al dispositiu.
- Fase 7: c&ograve;pia JSON versionada, restauraci&oacute; no destructiva, eliminaci&oacute;
  transaccional i avisos sobre l'emmagatzematge local.
- Fase 9: desplegament autom&agrave;tic a GitHub Pages preparat mitjan&ccedil;ant GitHub Actions.

## Publicaci&oacute;

Cada `push` a la branca `main` executa `.github/workflows/deploy.yml`, compila la PWA
amb la ruta del repositori i publica el directori `dist` a GitHub Pages.
