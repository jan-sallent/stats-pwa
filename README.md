# RAiP — Recol·lecció d’Accions i Possessions

RAiP és una aplicació web progressiva (PWA) pensada principalment per a mòbils
Android en vertical. Permet crear plantilles, preparar la convocatòria d’un partit
d’handbol, registrar-ne les accions i possessions, corregir l’historial i exportar
les dades en CSV.

L’aplicació no necessita servidor, compte d’usuari ni serveis de pagament. Tota la
informació funcional es desa al navegador del dispositiu mitjançant IndexedDB.
Després de la primera càrrega també pot funcionar sense connexió.

Aplicació publicada:
[https://jan-sallent.github.io/stats-pwa/](https://jan-sallent.github.io/stats-pwa/)

## Funcions principals

- Creació, edició, eliminació, importació i exportació de plantilles.
- Jugadors amb nom, cognoms, sobrenom, dorsal i posició.
- Separació entre jugadors de camp i porters.
- Selecció de convocats abans de començar cada partit.
- Registre altern de possessions d’atac i defensa.
- Llançaments amb resultat i posició opcional de 6 m, 7 m o 9 m.
- Accions de no-llançament, 2 minuts i temps morts.
- Comptador de possessió de la fase i comptador total de la part.
- Canvi automàtic de fase segons les regles de cada acció.
- Segona part iniciada en la fase contrària a la fase inicial.
- Desfer l’últim registre.
- Historial en ordre invers i edició d’accions passades.
- Exportació CSV individual o conjunta.
- Còpia de seguretat completa en JSON.
- Instal·lació com una aplicació i funcionament fora de línia.

## Flux d’ús

### 1. Crear una plantilla

Des de la pantalla inicial s’accedeix a Plantilles > Equips. Cada equip té:

- un nom;
- un o més jugadors;
- un dorsal únic per jugador dins de l’equip;
- una posició: jugador de camp o porter.

Les plantilles queden desades al dispositiu. No es pot eliminar una plantilla si
encara està vinculada a algun partit guardat.

### 2. Crear un partit

El formulari de partit demana:

- equip;
- jugadors convocats;
- rival;
- data i hora;
- competició;
- jornada.

En confirmar, el partit es desa com a esborrany. La pregunta sobre si el partit
comença en atac o en defensa apareix després d’haver-lo creat.

### 3. Registrar accions

La pantalla de captura mostra clarament:

- part actual;
- fase actual: atac o defensa;
- número de possessió d’atac o defensa;
- número total de possessió dins de la part.

El registre ordinari té tres passos:

1. Seleccionar Llançament o No llançament.
2. Seleccionar l’acció concreta i, si correspon, la posició del tir.
3. Seleccionar un jugador convocat.

Els jugadors de camp apareixen abans que els porters i s’ordenen per dorsal dins
de cada grup. En no-llançaments defensius, els porters es mostren en una secció
separada.

### 4. Accions especials

Els 2 minuts poden correspondre al CHSA o a un jugador rival. Només es demana
confirmació quan el registre implica un canvi de possessió.

Cada equip disposa d’un temps mort per part. En atac només es pot registrar el
temps mort del CHSA; en defensa només es pot registrar el de l’equip rival. El
temps mort es confirma abans de desar-se i no finalitza la possessió.

### 5. Corregir i finalitzar

ENRERE torna al pas visual anterior sense modificar les dades desades.

Desfer elimina l’últim esdeveniment persistent. L’historial permet modificar
qualsevol acció. Quan una edició altera si la possessió acaba o no, RAiP recalcula
la part, la fase i la possessió de totes les accions posteriors.

En passar a la segona part, la fase inicial és automàticament la contrària de la
primera part. En acabar la segona part es pot finalitzar el partit, consultar-ne
l’historial i exportar-lo.

## Regles d’acció actuals

### Atac

Llançaments:

- Fora: acaba la possessió.
- Parada: acaba la possessió.
- Gol: acaba la possessió.

No-llançaments:

- Passada.
- Recepció.
- Passos.
- Dobles.
- Àrea.
- Passiu.
- Falta en atac.

Totes les accions anteriors acaben la possessió segons la configuració actual.

### Defensa

Llançaments:

- Fora.
- Parada.
- Gol.

Només es pot seleccionar un porter i totes tres accions acaben la possessió.

No-llançaments:

- Recuperació defensiva: permet seleccionar qualsevol convocat.
- Error rival: no demana jugador.

Totes dues acaben la possessió.

## Arquitectura

RAiP és una SPA sense framework d’interfície. TypeScript crea directament els
elements HTML i registra els seus esdeveniments. La separació principal és:

~~~text
Pantalles i interacció
        |
        v
Regles de domini i catàleg d’accions
        |
        v
Repositoris Dexie / IndexedDB
        |
        +----> Exportació CSV
        |
        +----> Importació i còpies JSON
~~~

### Estructura del projecte

~~~text
stats-pwa/
├── .github/workflows/deploy.yml   Desplegament automàtic a GitHub Pages
├── public/                        Icones, logotip i fitxers públics de la PWA
├── scripts/check-csv.mjs          Comprovació mínima del serialitzador CSV
├── src/
│   ├── backup/                    Transferència de plantilles i backup complet
│   ├── config/                    Catàleg i regles estàtiques d’accions
│   ├── db/                        Esquema, migracions i operacions d’IndexedDB
│   ├── domain/                    Càlcul pur de l’estat del partit
│   ├── export/                    Serialització i descàrrega CSV
│   ├── models/                    Tipus del domini persistent
│   ├── pwa/                       Registre i actualització del service worker
│   ├── screens/                   Pantalles i controladors de la interfície
│   ├── styles/                    Disseny mobile-first
│   ├── ui/                        Format i protecció de text
│   ├── app.ts                     Navegació i renderitzat de pantalles
│   └── main.ts                    Punt d’entrada
├── index.html                     Document HTML base
├── package.json                   Ordres i dependències
├── tsconfig.json                  Configuració estricta de TypeScript
└── vite.config.ts                 Compilació, manifest i service worker
~~~

## Model de dades local

La base IndexedDB es diu handbol-stats i conté quatre taules:

### teams

Capçalera de cada plantilla: identificador, nom i dates de creació i actualització.

### players

Jugadors vinculats a un equip. L’índex compost equip + dorsal és únic, de manera
que no hi pot haver dos dorsals iguals dins d’una mateixa plantilla.

### matches

Metadades del partit, equip escollit, convocatòria, estat, fase inicial i dates.
La convocatòria es desa com una llista d’identificadors de jugador.

### events

Seqüència ordenada de les accions i els canvis de part. Cada acció conserva també
una fotografia del nom, sobrenom, dorsal i posició del jugador en el moment del
registre. Per això una edició posterior de la plantilla no canvia l’historial.

L’estat visible del partit no es desa en comptadors separats. Es reconstrueix
reproduint els esdeveniments en ordre. Aquest disseny fa fiables les operacions de
desfer i editar.

### Migracions

L’esquema de Dexie té cinc versions. Les migracions incorporen els camps afegits
durant l’evolució de l’aplicació i completen automàticament els registres antics.
No s’han d’eliminar versions antigues sense haver migrat abans totes les dades
existents.

## Exportació CSV

Els CSV utilitzen:

- codificació UTF-8 amb BOM;
- punt i coma com a separador;
- finals de línia CRLF;
- cometes dobles segons les regles habituals de CSV;
- protecció davant fórmules de full de càlcul introduïdes com a text.

El nom d’un fitxer individual segueix aquest patró:

~~~text
nom-equip_nom-rival_dd-mm-aaaa_hh-mm.csv
~~~

S’utilitzen guions en lloc de barres perquè la barra no és vàlida dins d’un nom
de fitxer a Android, Windows i altres sistemes.

Columnes actuals, en ordre:

1. partit_id
2. equip_id
3. equip
4. registre_id
5. ordre
6. rival
7. data_hora
8. competicio
9. jornada
10. estat_partit
11. tipus_registre
12. part
13. possessio
14. fase
15. categoria_accio
16. accio_id
17. accio
18. posicio_llancament
19. jugador_id
20. jugador_nom
21. jugador_cognoms
22. jugador_sobrenom
23. dorsal
24. posicio
25. data_registre

Els canvis de part tenen tipus_registre igual a canvi_part i deixen buides fase i
possessio. Un partit sense accions genera una fila de tipus partit perquè no se’n
perdin les metadades.

## Transferència i còpies de seguretat

### Plantilles

La pantalla d’equips exporta un JSON raip-team-transfer versionat. Conté només
equips i jugadors i està pensat per moure plantilles entre dispositius.

La importació valida:

- format i versió;
- tipus de tots els camps;
- relació entre jugador i equip;
- existència de jugadors a cada equip;
- dorsals únics.

### Còpia completa

L’historial permet descarregar un JSON amb equips, jugadors, partits i
esdeveniments. El restaurador accepta les versions 1, 2, 3 i 4 del format.

La restauració és no destructiva: fusiona els registres pel seu identificador i no
elimina dades locals que no apareguin al fitxer. Tota l’operació es fa dins d’una
transacció; un fitxer invàlid no restaura només una part de les dades.

## Desenvolupament local

Requisits recomanats:

- Node.js 24;
- npm;
- un navegador modern amb IndexedDB i service workers.

Instal·lació:

~~~powershell
npm install
~~~

Servidor de desenvolupament:

~~~powershell
npm run dev
~~~

Vite mostrarà una adreça local, habitualment http://localhost:5173. Els canvis de
codi es reflecteixen automàticament.

Compilació de producció:

~~~powershell
npm run build
~~~

Aquesta ordre executa primer TypeScript i després genera la PWA dins de dist.

Previsualització de la compilació:

~~~powershell
npm run preview
~~~

Comprovació manual del serialitzador CSV:

~~~powershell
node scripts/check-csv.mjs
~~~

## Proves recomanades

Abans de publicar:

1. Executar npm run build.
2. Crear una plantilla amb jugadors de camp i porters.
3. Exportar-la, eliminar-la en un entorn de prova i tornar-la a importar.
4. Crear un partit amb una convocatòria parcial.
5. Provar totes les accions d’atac i defensa.
6. Comprovar 2 minuts i els límits de temps mort per equip i part.
7. Desfer una acció i editar-ne una d’antiga.
8. Passar a la segona part i verificar la fase inicial contrària.
9. Finalitzar i exportar el CSV.
10. Obrir el CSV amb un full de càlcul i validar columnes, accents i files.
11. Descarregar i restaurar una còpia completa.
12. Instal·lar la PWA al mòbil i provar-la sense connexió.

Per provar service workers i instal·lació és preferible npm run preview o la versió
HTTPS de GitHub Pages. El mode de desenvolupament no reprodueix exactament la
memòria cau de producció.

## Instal·lació a Android

1. Obrir l’adreça publicada amb Chrome o un navegador compatible.
2. Obrir el menú del navegador.
3. Seleccionar Instal·lar aplicació o Afegir a la pantalla d’inici.
4. Obrir RAiP des de la nova icona.

Les dades pertanyen al navegador i al perfil on s’ha instal·lat. Esborrar les
dades del lloc o desinstal·lar el navegador pot eliminar-les. Cal descarregar
còpies de seguretat regularment.

## Desplegament

El workflow .github/workflows/deploy.yml s’executa en cada push a main:

1. descarrega el repositori;
2. instal·la Node.js 24;
3. executa npm ci;
4. configura la ruta base de GitHub Pages;
5. compila l’aplicació;
6. publica dist.

La variable PWA_BASE_PATH permet utilitzar / en local i /stats-pwa/ a GitHub
Pages. No s’ha de pujar manualment el directori dist.

## Dependències

- Dexie: capa tipada sobre IndexedDB.
- Vite: servidor local i compilador.
- TypeScript: comprovació estàtica del codi.
- vite-plugin-pwa: manifest, service worker i actualitzacions.
- @vite-pwa/assets-generator: generació d’icones de la PWA.

No hi ha backend, analítica, autenticació ni sincronització automàtica amb el
núvol.

## Privacitat i limitacions

- Les dades no surten del dispositiu excepte quan l’usuari exporta un fitxer.
- Dos navegadors del mateix mòbil tenen bases de dades diferents.
- No hi ha sincronització automàtica entre dispositius.
- Una còpia JSON és necessària per recuperar totes les dades; un CSV és una
  exportació d’anàlisi, no un fitxer de restauració.
- La persistència d’emmagatzematge és una petició al navegador, no una garantia
  absoluta.
