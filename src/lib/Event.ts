import type { Entity } from "../Entity/Entity";
import type { GameState } from "../model/GameState";

// -----------------------------------------------------------------------------
// イベント型
// -----------------------------------------------------------------------------

export type EvTopicLabel = keyof EvTopicPacketMap;

export type EvNoArgPacket = Record<string, never>;

export type EvTopicPacketMap = {
    interact: { entity: Entity };
    select_slot: { slotIndex: number };
};

// -----------------------------------------------------------------------------
// イベントブローカー
// -----------------------------------------------------------------------------

export type OnEventListener<E, T extends keyof E> = (state: GameState, packet: E[T]) => void;

export type PublishEvent<E> = <T extends keyof E>(topic: T, packet: E[T]) => void;
export type SubscribeEvent<E> = <T extends keyof E>(topic: T, listener: OnEventListener<E, T>) => () => void;

export type EventBroker<E> = {
    publish: PublishEvent<E>;
    subscribe: SubscribeEvent<E>;
};

export function createEventBroker<E>(gameState: GameState): EventBroker<E> {
    const listeners: { [key in keyof E]?: Set<OnEventListener<E, key>> } = {};

    function subscribe<T extends keyof E>(topic: T, listener: OnEventListener<E, T>) {
        const topic_listeners = listeners[topic] || new Set();
        topic_listeners.add(listener);
        listeners[topic] = topic_listeners;

        return () => {
            topic_listeners.delete(listener);
        };
    }

    function publish<T extends keyof E>(topic: T, packet: E[T]): void {
        console.log(`EventBroker: publish topic="${topic.toString()}", packet=`, packet);
        const topic_listeners = listeners[topic];
        if (topic_listeners) {
            for (const listener of topic_listeners) {
                listener(gameState, packet);
            }
        }
    }

    return { publish, subscribe };
}
