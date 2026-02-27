// -----------------------------------------------------------------------------
// 汎用イベントブローカー（ゲームロジックに依存しない）
// -----------------------------------------------------------------------------

export type OnEventListener<E, T extends keyof E> = (packet: E[T]) => void;

export type PublishEvent<E> = <T extends keyof E>(topic: T, packet: E[T]) => void;
export type SubscribeEvent<E> = <T extends keyof E>(topic: T, listener: OnEventListener<E, T>) => () => void;

export type EventBroker<E> = {
    publish: PublishEvent<E>;
    subscribe: SubscribeEvent<E>;
};

export function createEventBroker<E>(): EventBroker<E> {
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
        const topic_listeners = listeners[topic];
        if (topic_listeners) {
            for (const listener of topic_listeners) {
                listener(packet);
            }
        }
    }

    return { publish, subscribe };
}
