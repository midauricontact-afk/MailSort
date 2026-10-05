import type { CategoryId } from './types';

/**
 * Expéditeurs connus, indexés par « clé de marque » : le nom de domaine sans
 * extension (amazon.fr, amazon.com, marketplace.amazon.de → « amazon »).
 * Format : "cle" ou "cle:Nom affiché". Le nom par défaut est la clé en capitales.
 */
const RAW: Record<Exclude<CategoryId, 'personal' | 'other'>, string> = {
  shopping: `
    amazon:Amazon, cdiscount:Cdiscount, fnac:Fnac, darty:Darty, boulanger:Boulanger, ldlc:LDLC,
    zalando:Zalando, vinted:Vinted, leboncoin:Leboncoin, ebay:eBay, aliexpress:AliExpress,
    alibaba:Alibaba, temu:Temu, shein:SHEIN, wish:Wish, etsy:Etsy, rakuten:Rakuten,
    veepee:Veepee, showroomprive:Showroomprivé, asos:ASOS, hm:H&M, zara:Zara, uniqlo:Uniqlo,
    decathlon:Decathlon, ikea:IKEA, leroymerlin:Leroy Merlin, castorama:Castorama,
    manomano:ManoMano, conforama:Conforama, but:BUT, maisonsdumonde:Maisons du Monde,
    carrefour:Carrefour, auchan:Auchan, leclerc:E.Leclerc, e-leclerc:E.Leclerc, intermarche:Intermarché,
    lidl:Lidl, monoprix:Monoprix, franprix:Franprix, picard:Picard, sephora:Sephora,
    nocibe:Nocibé, yves-rocher:Yves Rocher, lookfantastic:Lookfantastic, kiabi:Kiabi,
    laredoute:La Redoute, galerieslafayette:Galeries Lafayette, printemps:Printemps,
    nike:Nike, adidas:Adidas, apple-store:Apple Store, micromania:Micromania, cultura:Cultura,
    action:Action, gifi:Gifi, lafourche:La Fourche, backmarket:Back Market, ubereats:Uber Eats,
    deliveroo:Deliveroo, justeat:Just Eat, dominos:Domino's, mcdonalds:McDonald's,
    colissimo:Colissimo, chronopost:Chronopost, laposte:La Poste, dpd:DPD, ups:UPS, fedex:FedEx,
    dhl:DHL, gls:GLS, mondialrelay:Mondial Relay, relaiscolis:Relais Colis, colisprive:Colis Privé,
    shopify:Shopify, wallapop:Wallapop, label-emmaus:Label Emmaüs, rueducommerce:Rue du Commerce,
    materiel:Materiel.net, topachat:Top Achat, grosbill:Grosbill, nintendo:Nintendo,
    playstation:PlayStation, steampowered:Steam, epicgames:Epic Games, instant-gaming:Instant Gaming,
    g2a:G2A, eneba:Eneba, humblebundle:Humble Bundle, gog:GOG, ubisoft:Ubisoft, ea:EA,
    blizzard:Blizzard, riotgames:Riot Games, roblox:Roblox, hoyoverse:HoYoverse, bershka:Bershka,
    pullandbear:Pull&Bear, primark:Primark, celio:Celio, jules:Jules, promod:Promod,
    undiz:Undiz, etam:Etam, courir:Courir, footlocker:Foot Locker, jdsports:JD Sports,
    vans:Vans, converse:Converse, newbalance:New Balance, asics:ASICS, puma:Puma,
    lego:LEGO, king-jouet:King Jouet, joueclub:JouéClub, smyths:Smyths Toys, natureetdecouvertes:Nature & Découvertes,
    thomann:Thomann, woodbrass:Woodbrass, vistaprint:Vistaprint, photobox:Photobox,
    cheerz:Cheerz, groupon:Groupon, too-good-to-go:Too Good To Go, toogoodtogo:Too Good To Go,
    hellofresh:HelloFresh, quitoque:Quitoque, frichti:Frichti, nespresso:Nespresso
  `,
  bank: `
    paypal:PayPal, boursorama:BoursoBank, boursobank:BoursoBank, creditagricole:Crédit Agricole,
    credit-agricole:Crédit Agricole, ca-paris:Crédit Agricole, societegenerale:Société Générale,
    bnpparibas:BNP Paribas, mabanque:BNP Paribas, lcl:LCL, labanquepostale:La Banque Postale,
    banquepopulaire:Banque Populaire, caisse-epargne:Caisse d'Épargne, caisse-epargne-fr:Caisse d'Épargne,
    creditmutuel:Crédit Mutuel, cic:CIC, hellobank:Hello bank!, fortuneo:Fortuneo,
    monabanq:Monabanq, ing:ING, axa:AXA, allianz:Allianz, maif:MAIF, macif:MACIF, matmut:Matmut,
    groupama:Groupama, mma:MMA, gmf:GMF, harmonie-mutuelle:Harmonie Mutuelle, mgen:MGEN,
    alan:Alan, lydia-app:Lydia, lydia:Lydia, sumeria:Sumeria, revolut:Revolut, n26:N26,
    qonto:Qonto, shine:Shine, nickel:Nickel, wise:Wise, transferwise:Wise, stripe:Stripe,
    klarna:Klarna, oney:Oney, cofidis:Cofidis, floa:Floa, younited:Younited, sofinco:Sofinco,
    alma:Alma, scalapay:Scalapay, visa:Visa, mastercard:Mastercard, americanexpress:American Express,
    edf:EDF, engie:Engie, totalenergies:TotalEnergies, ekwateur:Ekwateur, veolia:Veolia,
    suez:Suez, orange:Orange, sfr:SFR, bouyguestelecom:Bouygues Telecom, free:Free,
    free-mobile:Free Mobile, sosh:Sosh, red-by-sfr:RED by SFR, bouygues:Bouygues,
    impots:Impôts, ameli:Ameli, caf:CAF, urssaf:Urssaf, francetravail:France Travail,
    pole-emploi:France Travail, ants:ANTS, service-public:Service Public, lassuranceretraite:Assurance Retraite,
    msa:MSA, coinbase:Coinbase, binance:Binance, kraken:Kraken, trade-republic:Trade Republic,
    traderepublic:Trade Republic, degiro:DEGIRO, yomoni:Yomoni, linxea:Linxea, pumpkin-app:Pumpkin,
    pumpkin:Pumpkin, leetchi:Leetchi, lunchr:Swile, swile:Swile, edenred:Edenred, sodexo:Pluxee,
    pluxee:Pluxee, docusign:DocuSign, yousign:Yousign, qonto-mail:Qonto
  `,
  social: `
    facebook:Facebook, facebookmail:Facebook, instagram:Instagram, twitter:X (Twitter), x:X (Twitter),
    linkedin:LinkedIn, tiktok:TikTok, snapchat:Snapchat, pinterest:Pinterest, reddit:Reddit,
    redditmail:Reddit, discord:Discord, discordapp:Discord, twitch:Twitch, youtube:YouTube,
    whatsapp:WhatsApp, telegram:Telegram, threads:Threads, bsky:Bluesky, bluesky:Bluesky,
    mastodon:Mastodon, tumblr:Tumblr, quora:Quora, meetup:Meetup, vk:VK, nextdoor:Nextdoor,
    strava:Strava, goodreads:Goodreads, letterboxd:Letterboxd, deviantart:DeviantArt,
    artstation:ArtStation, behance:Behance, dribbble:Dribbble, medium:Medium, substack:Substack,
    patreon:Patreon, kofi:Ko-fi, ko-fi:Ko-fi, tipeee:Tipeee, onlyfans:OnlyFans, tinder:Tinder,
    bumble:Bumble, hinge:Hinge, happn:Happn, badoo:Badoo, meetic:Meetic, yubo:Yubo, bereal:BeReal,
    steamcommunity:Steam Community, kick:Kick, wattpad:Wattpad, myanimelist:MyAnimeList, anilist:AniList
  `,
  newsletters: `
    mailchimp:Mailchimp, mailchimpapp:Mailchimp, sendinblue:Brevo, brevo:Brevo, mailjet:Mailjet,
    sendgrid:SendGrid, klaviyo:Klaviyo, hubspot:HubSpot, hs-email:HubSpot, mcsv:Mailchimp,
    rsgsv:Mailchimp, list-manage:Mailchimp, beehiiv:beehiiv, convertkit:Kit, kit:Kit,
    getrevue:Revue, buttondown:Buttondown, lemonde:Le Monde, lefigaro:Le Figaro,
    liberation:Libération, leparisien:Le Parisien, ouest-france:Ouest-France, 20minutes:20 Minutes,
    franceinfo:franceinfo, francetvinfo:franceinfo, lexpress:L'Express, lepoint:Le Point,
    nouvelobs:L'Obs, huffingtonpost:HuffPost, konbini:Konbini, brut:Brut, numerama:Numerama,
    frandroid:Frandroid, 01net:01net, clubic:Clubic, jeuxvideo:Jeuxvideo.com, millenium:Millenium,
    gamekult:Gamekult, allocine:AlloCiné, senscritique:SensCritique, marmiton:Marmiton,
    750g:750g, cuisineaz:CuisineAZ, doctissimo:Doctissimo, aufeminin:aufeminin, marieclaire:Marie Claire,
    vogue:Vogue, elle:ELLE, nytimes:The New York Times, theguardian:The Guardian,
    washingtonpost:The Washington Post, economist:The Economist, morningbrew:Morning Brew,
    quartz:Quartz, tldr:TLDR, tldrnewsletter:TLDR, hebdo:Hebdo, welcometothejungle:Welcome to the Jungle,
    indeed:Indeed, glassdoor:Glassdoor, hellowork:HelloWork, monster:Monster, cadremploi:Cadremploi,
    jobteaser:JobTeaser, apec:Apec, groupon-news:Groupon, ticketmaster:Ticketmaster,
    fnacspectacles:Fnac Spectacles, seetickets:See Tickets, eventbrite:Eventbrite,
    shotgun:Shotgun, dice:DICE, deezer:Deezer, spotify:Spotify, netflix:Netflix,
    primevideo:Prime Video, disneyplus:Disney+, canalplus:Canal+, crunchyroll:Crunchyroll,
    adn:ADN, molotov:Molotov, mycanal:Canal+, salto:Salto, appletv:Apple TV, hbomax:Max, max:Max,
    paramountplus:Paramount+, qobuz:Qobuz, tidal:Tidal, audible:Audible, kobo:Kobo,
    duolingo:Duolingo, babbel:Babbel, coursera:Coursera, udemy:Udemy, openclassrooms:OpenClassrooms,
    skillshare:Skillshare, masterclass:MasterClass, domestika:Domestika, canva:Canva,
    wix:Wix, squarespace:Squarespace
  `,
  services: `
    google:Google, accounts-google:Google, googlemail:Google, apple:Apple, icloud-apple:Apple,
    microsoft:Microsoft, microsoftonline:Microsoft, office:Microsoft, office365:Microsoft,
    xbox:Xbox, skype:Skype, github:GitHub, gitlab:GitLab, bitbucket:Bitbucket, atlassian:Atlassian,
    notion:Notion, slack:Slack, zoom:Zoom, dropbox:Dropbox, box:Box, wetransfer:WeTransfer,
    adobe:Adobe, figma:Figma, openai:OpenAI, anthropic:Anthropic, claude:Claude, mistral:Mistral AI,
    vercel:Vercel, netlify:Netlify, cloudflare:Cloudflare, heroku:Heroku, digitalocean:DigitalOcean,
    ovh:OVHcloud, ovhcloud:OVHcloud, ionos:IONOS, o2switch:o2switch, hostinger:Hostinger, gandi:Gandi,
    godaddy:GoDaddy, namecheap:Namecheap, aws:AWS, amazonaws:AWS, firebase:Firebase,
    authy:Authy, twilio:Twilio, okta:Okta, auth0:Auth0, lastpass:LastPass, 1password:1Password,
    bitwarden:Bitwarden, dashlane:Dashlane, nordvpn:NordVPN, expressvpn:ExpressVPN, protonvpn:Proton VPN,
    proton:Proton, samsung:Samsung, xiaomi:Xiaomi, huawei:Huawei, oneplus:OnePlus, sony:Sony,
    logitech:Logitech, razer:Razer, steam:Steam, battle:Battle.net, battlenet:Battle.net,
    epicgames-accounts:Epic Games, doctolib:Doctolib, maiia:Maiia, qare:Qare, livi:Livi,
    franceconnect:FranceConnect, laposte-id:L'Identité Numérique, uber:Uber, bolt:Bolt, freenow:FREENOW,
    heetch:Heetch, lime:Lime, dott:Dott, blablacar-account:BlaBlaCar, mondial-assistance:Mondial Assistance,
    trello:Trello, asana:Asana, monday:monday.com, clickup:ClickUp, airtable:Airtable,
    calendly:Calendly, typeform:Typeform, jotform:Jotform, surveymonkey:SurveyMonkey,
    zapier:Zapier, ifttt:IFTTT, discord-security:Discord, epic:Epic Games, mojang:Mojang,
    minecraft:Minecraft, curseforge:CurseForge, overwolf:Overwolf, itch:itch.io, unity:Unity,
    unity3d:Unity, unrealengine:Unreal Engine, blender:Blender, jetbrains:JetBrains, docker:Docker,
    npmjs:npm, pypi:PyPI, stackoverflow:Stack Overflow, stackexchange:Stack Exchange,
    gravatar:Gravatar, wordpress:WordPress, automattic:Automattic, ecoledirecte:EcoleDirecte,
    pronote:Pronote, index-education:Pronote, parcoursup:Parcoursup, crous:Crous, messervices:Crous
  `,
  travel: `
    sncf:SNCF, sncf-connect:SNCF Connect, oui:SNCF, ouigo:OUIGO, tgvinoui:SNCF, eurostar:Eurostar,
    thalys:Eurostar, trainline:Trainline, flixbus:FlixBus, blablacar:BlaBlaCar, blablacarbus:BlaBlaCar Bus,
    ratp:RATP, idfm:Île-de-France Mobilités, airfrance:Air France, klm:KLM, transavia:Transavia,
    easyjet:easyJet, ryanair:Ryanair, vueling:Vueling, volotea:Volotea, lufthansa:Lufthansa,
    britishairways:British Airways, iberia:Iberia, emirates:Emirates, qatarairways:Qatar Airways,
    turkishairlines:Turkish Airlines, airfrance-klm:Air France-KLM, corsair:Corsair, airtahitinui:Air Tahiti Nui,
    frenchbee:French bee, airbnb:Airbnb, booking:Booking.com, expedia:Expedia, hotels:Hotels.com,
    trivago:trivago, kayak:Kayak, skyscanner:Skyscanner, opodo:Opodo, edreams:eDreams, lastminute:lastminute.com,
    govoyages:GO Voyages, liligo:Liligo, tripadvisor:Tripadvisor, accor:Accor, all:ALL Accor,
    marriott:Marriott, hilton:Hilton, ibis:ibis, novotel:Novotel, bestwestern:Best Western,
    clubmed:Club Med, pierreetvacances:Pierre & Vacances, centerparcs:Center Parcs, belambra:Belambra,
    campings:Campings.com, huttopia:Huttopia, abritel:Abritel, vrbo:Vrbo, gites-de-france:Gîtes de France,
    europcar:Europcar, hertz:Hertz, sixt:Sixt, avis:Avis, rentalcars:Rentalcars, getaround:Getaround,
    leasys:Leasys, ada:ADA, ucar:Ucar, aeroportsdeparis:Paris Aéroport, parisaeroport:Paris Aéroport,
    vinci-autoroutes:Vinci Autoroutes, bipandgo:Bip&Go, ulys:Ulys, ferryhopper:Ferryhopper,
    brittany-ferries:Brittany Ferries, corsica-ferries:Corsica Ferries, omio:Omio, rome2rio:Rome2Rio,
    hostelworld:Hostelworld, agoda:Agoda, hopper:Hopper, flightradar24:Flightradar24, tripit:TripIt
  `,
};

/** Alias : domaines différents d'une même marque. */
export const BRAND_ALIASES: Record<string, string> = {
  amzn: 'amazon',
  temuemail: 'temu',
  'aliexpress-media': 'aliexpress',
  'ebay-kleinanzeigen': 'ebay',
  'paypal-communication': 'paypal',
  'shopify-email': 'shopify',
  'uber-eats': 'ubereats',
  'amazon-adsystem': 'amazon',
  facebookmail: 'facebook',
  fb: 'facebook',
  meta: 'facebook',
  twitter: 'x',
  redditmail: 'reddit',
  discordapp: 'discord',
  'sncf-connect': 'sncf',
  tgvinoui: 'sncf',
  oui: 'sncf',
  googlemail: 'google',
  'e-leclerc': 'leclerc',
  boursobank: 'boursorama',
  'credit-agricole': 'creditagricole',
  'ca-paris': 'creditagricole',
  mabanque: 'bnpparibas',
  'caisse-epargne-fr': 'caisse-epargne',
  'lydia-app': 'lydia',
  transferwise: 'wise',
  'pole-emploi': 'francetravail',
  traderepublic: 'trade-republic',
  'pumpkin-app': 'pumpkin',
  lunchr: 'swile',
  sodexo: 'pluxee',
  francetvinfo: 'franceinfo',
  tldrnewsletter: 'tldr',
  mycanal: 'canalplus',
  hbomax: 'max',
  unity3d: 'unity',
  stackexchange: 'stackoverflow',
  thalys: 'eurostar',
  parisaeroport: 'aeroportsdeparis',
  'too-good-to-go': 'toogoodtogo',
  steamcommunity: 'steam',
  steampowered: 'steam',
  battlenet: 'battle',
  ovhcloud: 'ovh',
  amazonaws: 'aws',
  mailchimpapp: 'mailchimp',
  mcsv: 'mailchimp',
  rsgsv: 'mailchimp',
  'list-manage': 'mailchimp',
  sendinblue: 'brevo',
  'index-education': 'pronote',
  ko: 'kofi',
  'ko-fi': 'kofi',
  bsky: 'bluesky',
  office365: 'microsoft',
  microsoftonline: 'microsoft',
};

/**
 * Domaines « techniques » : quand un mail vient de l'un d'eux, le domaine ne
 * dit rien de l'entreprise réelle (ex. bounce.mailchimp.com envoyé pour une marque).
 * On regroupe alors par nom d'expéditeur affiché.
 */
export const ESP_KEYS = new Set([
  'mailchimp', 'brevo', 'mailjet', 'sendgrid', 'klaviyo', 'hubspot', 'hs-email',
  'amazonses', 'mandrillapp', 'mailgun', 'sparkpostmail', 'mcdlv', 'exacttarget', 'salesforce',
  'customeriomail', 'intercom-mail', 'postmarkapp', 'sendpulse', 'emarsys', 'selligent',
]);

export interface KnownSender {
  name: string;
  category: CategoryId;
}

function parseRaw(): Map<string, KnownSender> {
  const map = new Map<string, KnownSender>();
  for (const [category, raw] of Object.entries(RAW) as [CategoryId, string][]) {
    for (const entry of raw.split(',')) {
      const trimmed = entry.trim();
      if (!trimmed) continue;
      const idx = trimmed.indexOf(':');
      const key = (idx === -1 ? trimmed : trimmed.slice(0, idx)).trim().toLowerCase();
      const name = idx === -1 ? capitalize(key) : trimmed.slice(idx + 1).trim();
      const canonical = BRAND_ALIASES[key] ?? key;
      if (!map.has(canonical)) map.set(canonical, { name, category });
      if (!map.has(key)) map.set(key, { name, category });
    }
  }
  return map;
}

export function capitalize(s: string): string {
  return s
    .split(/[-_.]/)
    .filter(Boolean)
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(' ');
}

export const KNOWN_SENDERS: Map<string, KnownSender> = parseRaw();

/** Messageries grand public : on y regroupe par adresse e-mail (une personne = un groupe). */
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'msn.com', 'ymail.com', 'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'aol.fr', 'orange.fr', 'wanadoo.fr', 'free.fr', 'sfr.fr', 'neuf.fr', 'laposte.net',
  'bbox.fr', 'protonmail.com', 'protonmail.ch', 'proton.me', 'pm.me', 'numericable.fr',
  'skynet.be', 'tutanota.com', 'tuta.io', 'zoho.com', 'mail.com', 'yandex.com', 'yandex.ru',
  'club-internet.fr', 'aliceadsl.fr', 'voila.fr', 'hotmail.com', 'hotmail.fr', 'outlook.com',
  'outlook.fr', 'live.com', 'live.fr', 'yahoo.com', 'yahoo.fr', 'gmx.com', 'gmx.fr', 'gmx.de',
]);
const PERSONAL_SLD = /^(hotmail|outlook|live|yahoo|gmx|web)\.[a-z.]+$/;

/** Messageries grand public : on y regroupe par adresse e-mail (une personne = un groupe). */
export function isPersonalProvider(registrableDomain: string): boolean {
  return PERSONAL_DOMAINS.has(registrableDomain) || PERSONAL_SLD.test(registrableDomain);
}
