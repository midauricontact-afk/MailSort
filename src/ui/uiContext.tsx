import { createContext, useContext } from 'react';

export type TabId = 'sort' | 'senders' | 'storage' | 'tips' | 'settings';

export interface DialogAction {
  id: string;
  label: string;
  style?: 'default' | 'destructive' | 'cancel' | 'primary';
}

export interface DialogRequest {
  title: string;
  message?: string;
  actions: DialogAction[];
}

export interface UI {
  openSender(key: string): void;
  /** Affiche une boîte de confirmation ; renvoie l'id de l'action choisie (null si annulé). */
  ask(req: DialogRequest): Promise<string | null>;
  pickCategory(key: string): void;
  goTab(tab: TabId): void;
}

export const UIContext = createContext<UI | null>(null);

export function useUI(): UI {
  const ui = useContext(UIContext);
  if (!ui) throw new Error('UIContext manquant');
  return ui;
}
