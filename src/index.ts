import * as Manager from './core/manager';
import * as Utils from './core/utils';
import * as Types from './core/types';
import * as Bot from './core/bot';

export * from './core/manager';
export * from './core/types';
export * from './core/utils';
export * from './core/bot';

export default {
	...Manager,
	...Utils,
	...Types,
	...Bot,
};
