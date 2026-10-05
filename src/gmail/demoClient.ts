import type { GmailFilter, MessageMeta } from '../core/types';
import type { GmailApi, GmailLabel, Progress } from './api';

/**
 * Faux compte Gmail pour essayer l'app sans se connecter.
 * Rien ne quitte le téléphone : toutes les actions sont simulées en mémoire.
 */
const SENDERS: [string, string, string[], { unsub?: boolean; weight: number; big?: boolean; readRate: number }][] = [
  ['Amazon.fr', 'auto-confirm@amazon.fr', ['Votre commande a été expédiée', 'Votre colis est livré', 'Votre commande n°402-1234'], { weight: 40, readRate: 0.8 }],
  ['Amazon', 'store-news@amazon.com', ['Offres du jour : jusqu\'à -40%', 'Recommandé pour vous'], { unsub: true, weight: 30, readRate: 0.05 }],
  ['Amazon Marketplace', 'seller@marketplace.amazon.fr', ['Message du vendeur'], { weight: 5, readRate: 1 }],
  ['Vinted', 'no-reply@vinted.fr', ['Ton article a été vendu !', 'Nouveau message de Julie'], { weight: 25, readRate: 0.7 }],
  ['SHEIN', 'shein@notice.shein.com', ['-70% : dernière chance', 'Nouveautés de la semaine'], { unsub: true, weight: 60, readRate: 0 }],
  ['Temu', 'temu@eu.temuemail.com', ['Ton cadeau gratuit t\'attend', 'Offre flash'], { unsub: true, weight: 50, readRate: 0 }],
  ['BoursoBank', 'service.client@boursobank.com', ['Votre relevé de compte est disponible', 'Nouvelle opération'], { weight: 15, readRate: 0.9, big: true }],
  ['EDF', 'ne-pas-repondre@edf.fr', ['Votre facture est disponible', 'Votre échéancier'], { weight: 12, readRate: 0.8, big: true }],
  ['Free Mobile', 'freemobile@free-mobile.fr', ['Votre facture Free Mobile'], { weight: 12, readRate: 0.5 }],
  ['Instagram', 'no-reply@mail.instagram.com', ['lea_photo a aimé ta publication', 'Tu as 5 nouvelles notifications'], { unsub: true, weight: 80, readRate: 0.1 }],
  ['Facebook', 'notification@facebookmail.com', ['Marc a commenté ta photo', 'Souvenirs du jour'], { unsub: true, weight: 45, readRate: 0.05 }],
  ['LinkedIn', 'messages-noreply@linkedin.com', ['Vous avez une nouvelle invitation', 'Vos statistiques de la semaine'], { unsub: true, weight: 35, readRate: 0.15 }],
  ['TikTok', 'no-reply@account.tiktok.com', ['Code de vérification TikTok'], { weight: 6, readRate: 1 }],
  ['Google', 'no-reply@accounts.google.com', ['Alerte de sécurité', 'Nouvelle connexion sur iPhone'], { weight: 10, readRate: 1 }],
  ['Apple', 'no_reply@email.apple.com', ['Votre reçu Apple', 'Votre identifiant Apple a été utilisé pour se connecter'], { weight: 8, readRate: 0.9 }],
  ['Discord', 'noreply@discord.com', ['Vérifie ton adresse e-mail', 'Nouvelle connexion'], { weight: 6, readRate: 1 }],
  ['SNCF Connect', 'noreply@sncf-connect.com', ['Votre e-billet Paris → Lyon', 'Rappel de votre voyage'], { weight: 10, readRate: 1, big: true }],
  ['Airbnb', 'automated@airbnb.com', ['Réservation confirmée à Lisbonne'], { weight: 6, readRate: 1 }],
  ['Ryanair', 'noreply@ryanair.com', ['Votre carte d\'embarquement', 'Promos vols à 19,99 €'], { unsub: true, weight: 14, readRate: 0.3 }],
  ['Le Monde', 'newsletters@lemonde.fr', ['La Matinale du Monde', 'Les essentiels de la semaine'], { unsub: true, weight: 70, readRate: 0.12 }],
  ['Netflix', 'info@mailer.netflix.com', ['Nouveau sur Netflix', 'Votre abonnement'], { unsub: true, weight: 18, readRate: 0.2 }],
  ['Deliveroo', 'noreply@t.deliveroo.com', ['-30% sur ta prochaine commande', 'Ta commande est en route'], { unsub: true, weight: 25, readRate: 0.15 }],
  ['Ma Petite Boutique', 'bounce-mc@mailchimpapp.net', ['Les nouveautés d\'automne 🍂'], { unsub: true, weight: 15, readRate: 0 }],
  ['Maman', 'sylvie.martin@orange.fr', ['Dimanche midi ?', 'Photos des vacances'], { weight: 14, readRate: 1, big: true }],
  ['Léa', 'lea.dubois@gmail.com', ['Re: anniversaire', 'Les photos !'], { weight: 10, readRate: 1, big: true }],
  ['Club de badminton', 'contact@bad-club-lyon.fr', ['Planning des entraînements', 'Assemblée générale'], { weight: 8, readRate: 0.7 }],
];

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function generate(): MessageMeta[] {
  const r = rand(42);
  const now = Date.now();
  const out: MessageMeta[] = [];
  let n = 0;
  for (const [name, email, subjects, opts] of SENDERS) {
    for (let i = 0; i < opts.weight; i++) {
      const ageDays = Math.floor(r() * r() * 900);
      const big = opts.big && r() < 0.25;
      const labels = ['INBOX'];
      if (r() > opts.readRate) labels.push('UNREAD');
      if (opts.unsub) labels.push(email.includes('instagram') || email.includes('facebook') || email.includes('linkedin') ? 'CATEGORY_SOCIAL' : 'CATEGORY_PROMOTIONS');
      out.push({
        id: `demo${++n}`,
        threadId: `demo${n}`,
        fromEmail: email,
        fromName: name,
        subject: subjects[Math.floor(r() * subjects.length)],
        date: now - ageDays * 86_400_000 - Math.floor(r() * 86_400_000),
        size: big ? 2_000_000 + Math.floor(r() * 12_000_000) : 15_000 + Math.floor(r() * 120_000),
        labelIds: labels,
        listUnsubscribe: opts.unsub ? `<mailto:unsubscribe@${email.split('@')[1]}>, <https://${email.split('@')[1]}/unsubscribe>` : undefined,
        listUnsubscribePost: opts.unsub ? 'List-Unsubscribe=One-Click' : undefined,
      });
    }
  }
  return out.sort((a, b) => b.date - a.date);
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class DemoGmailClient implements GmailApi {
  private messages = new Map(generate().map((m) => [m.id, m]));
  private labels: GmailLabel[] = [];
  private filters: GmailFilter[] = [];
  private seq = 0;

  async getProfile() {
    return { emailAddress: 'demo@gmail.com', messagesTotal: this.messages.size };
  }

  async listMessageIds(query: string, max: number, onProgress?: Progress) {
    await wait(200);
    const match = compileQuery(query);
    const ids = [...this.messages.values()]
      .filter((m) => !m.labelIds.includes('TRASH') && match(m))
      .slice(0, max)
      .map((m) => m.id);
    onProgress?.(ids.length, max);
    return ids;
  }

  async getMessagesMetadata(ids: string[], onProgress?: Progress) {
    const out: MessageMeta[] = [];
    for (let i = 0; i < ids.length; i += 50) {
      await wait(60);
      for (const id of ids.slice(i, i + 50)) {
        const m = this.messages.get(id);
        if (m) out.push({ ...m, labelIds: [...m.labelIds] });
      }
      onProgress?.(Math.min(ids.length, i + 50), ids.length);
    }
    return out;
  }

  async listLabels() {
    return [...this.labels];
  }

  async createLabel(name: string) {
    const existing = this.labels.find((l) => l.name === name);
    if (existing) return existing;
    const label = { id: `Label_${++this.seq}`, name, type: 'user' as const };
    this.labels.push(label);
    return label;
  }

  async batchModify(ids: string[], add: string[], remove: string[], onProgress?: Progress) {
    await wait(150);
    for (const id of ids) {
      const m = this.messages.get(id);
      if (!m) continue;
      m.labelIds = [...new Set([...m.labelIds.filter((l) => !remove.includes(l)), ...add])];
    }
    onProgress?.(ids.length, ids.length);
  }

  async trashMessages(ids: string[], onProgress?: Progress) {
    await wait(300);
    for (const id of ids) {
      const m = this.messages.get(id);
      if (m) m.labelIds = [...m.labelIds.filter((l) => l !== 'INBOX'), 'TRASH'];
    }
    onProgress?.(ids.length, ids.length);
    return ids;
  }

  async listFilters() {
    return [...this.filters];
  }

  async createFilter(filter: GmailFilter) {
    const f = { ...filter, id: `filter_${++this.seq}` };
    this.filters.push(f);
    return f;
  }

  async deleteFilter(id: string) {
    this.filters = this.filters.filter((f) => f.id !== id);
  }

  async sendRawMessage() {
    await wait(200);
  }
}

/** Mini-interpréteur des requêtes produites par MailSort (from:, older_than:, larger:, is:unread). */
function compileQuery(query: string): (m: MessageMeta) => boolean {
  const tests: ((m: MessageMeta) => boolean)[] = [];
  const from = query.match(/from:\(([^)]+)\)|from:(\S+)/);
  if (from) {
    const terms = (from[1] ?? from[2]).split(/\s+OR\s+/i).map((t) => t.trim().toLowerCase());
    tests.push((m) => terms.some((t) => m.fromEmail === t || m.fromEmail.endsWith(`@${t}`) || m.fromEmail.endsWith(`.${t}`)));
  }
  const older = query.match(/older_than:(\d+)m/);
  if (older) {
    const limit = Date.now() - Number(older[1]) * 30.44 * 86_400_000;
    tests.push((m) => m.date < limit);
  }
  const larger = query.match(/larger:(\d+)M/);
  if (larger) tests.push((m) => m.size > Number(larger[1]) * 1024 * 1024);
  if (/is:unread/.test(query)) tests.push((m) => m.labelIds.includes('UNREAD'));
  return (m) => tests.every((t) => t(m));
}
