"use client";

import { createContext, useContext } from "react";

// True quando o funil está aberto em modo Visualizar (convidado sem permissão
// de edição). Os componentes de nó usam isto para bloquear edição inline.
export const ReadOnlyContext = createContext(false);

export const useReadOnly = () => useContext(ReadOnlyContext);
