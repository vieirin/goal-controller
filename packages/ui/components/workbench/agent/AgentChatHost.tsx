/**
 * Holds the agent's transcript above the drawer's panel, so closing the
 * drawer doesn't lose it. Only the drawer reads it: the model views it
 * wraps are its `children`, which a run's updates don't re-render.
 */
import { createContext, useContext, type ReactNode } from 'react';
import { useAgentChat, type AgentChat } from './useAgentChat';

const AgentChatContext = createContext<AgentChat | null>(null);

export function AgentChatHost({ children }: { children: ReactNode }) {
  const chat = useAgentChat();
  return (
    <AgentChatContext.Provider value={chat}>
      {children}
    </AgentChatContext.Provider>
  );
}

export const useAgentChatContext = (): AgentChat => {
  const chat = useContext(AgentChatContext);
  if (!chat) throw new Error('useAgentChatContext outside AgentChatHost');
  return chat;
};
