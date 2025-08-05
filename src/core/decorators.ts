import { Belote } from './manager';
import EventEmitter from 'events';

export function withErrorHandling(_: unknown, propertyName: string | symbol, descriptor: PropertyDescriptor): PropertyDescriptor {
	const originalMethod = descriptor.value;

	descriptor.value = function (this: EventEmitter, ...args: unknown[]): unknown {
		try {
			const result = originalMethod.apply(this, args);

			if (result && typeof result === 'object' && result !== null && 'catch' in result && typeof result.catch === 'function') {
				return (result as Promise<unknown>).catch((error: unknown) => {
					if (this.emit && typeof this.emit === 'function') this.emit('error', error instanceof Error ? error : new Error(`${String(propertyName)}: ${String(error)}`));
					throw error;
				});
			}

			return result;
		} catch (error: unknown) {
			if (this.emit && typeof this.emit === 'function') this.emit('error', error instanceof Error ? error : new Error(`${String(propertyName)}: ${String(error)}`));
			throw error;
		}
	};

	return descriptor;
}

export function withErrorHandlingClass<T extends typeof Belote>(constructor: T): T {
	const prototype = constructor.prototype;
	const methodNames = Object.getOwnPropertyNames(prototype);

	methodNames.forEach((name: string) => {
		if (name === 'constructor') return;

		const descriptor = Object.getOwnPropertyDescriptor(prototype, name);
		if (descriptor && typeof descriptor.value === 'function' && !name.startsWith('_')) {
			withErrorHandling(prototype, name, descriptor);
			Object.defineProperty(prototype, name, descriptor);
		}
	});

	return constructor;
}
