"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartDI = exports.Autowired = exports.Component = void 0;
const require_all_1 = __importDefault(require("require-all"));
require("reflect-metadata");
function Component(arg1, arg2, arg3) {
    return function (target) {
        let name, singleton, options;
        if (typeof arg1 === 'undefined' || typeof arg1 === 'object') {
            name = target.name;
            options = arg1;
            singleton = !arg2;
        }
        else if (typeof arg2 === 'boolean') {
            name = arg1;
            options = undefined;
            singleton = !arg2;
        }
        else {
            name = arg1;
            options = arg2;
            singleton = !arg3;
        }
        Reflect.defineMetadata('smartdi:component', name, target);
        Reflect.defineMetadata('smartdi:singleton', singleton, target);
        Reflect.defineMetadata('smartdi:options', options, target);
    };
}
exports.Component = Component;
function Autowired(arg1, options) {
    return function (target, prop) {
        let autowireds = Reflect.getMetadata('smartdi:autowireds', target) || {};
        autowireds[prop] = { clue: arg1, options: options };
        Reflect.defineMetadata('smartdi:autowireds', autowireds, target);
    };
}
exports.Autowired = Autowired;
/**
 * Main entry of SmartDI framework.
 *
 */
class SmartDI {
    constructor() {
        throw new Error('Do not instantiate this class.');
    }
    /**
     * Wire up all components according to specified options.
     *
     * @param options - autowire options
     *
     */
    static autowire(options) {
        if (SmartDI.autowired)
            throw new Error('SmartDI.autowire() can only be called once.');
        SmartDI.autowired = true;
        for (let name of Object.keys(options.components || {})) {
            let component = options.components[name];
            SmartDI.registry[name] = {
                source: 'built-in',
                name: name,
                class: component.constructor,
                options: undefined,
                singleton: component,
            };
        }
        // Iterate all dirs to find and instantiate all components.
        for (let scan of options.scans || []) {
            // Load all modules.
            let modules = require_all_1.default({ dirname: scan, filter: /.+\.js$/ });
            // Iterate all modules.
            for (let module of Object.values(modules)) {
                // Iterate all exported symbols
                for (let symbol of Object.values(module)) {
                    // Not a function, ignore.
                    if (typeof symbol !== 'function')
                        continue;
                    // Fetch metadata, ignore if not found.
                    let name = Reflect.getMetadata('smartdi:component', symbol);
                    if (!name)
                        continue;
                    // Check conflicts
                    let exist = SmartDI.registry[name];
                    if (exist)
                        throw new Error(`Duplicate component name: ${name}`);
                    let singleton = Reflect.getMetadata('smartdi:singleton', symbol);
                    let options = Reflect.getMetadata('smartdi:options', symbol);
                    // Add to registry.
                    SmartDI.registry[name] = {
                        source: 'scan',
                        name: name,
                        class: symbol,
                        options: options,
                        singleton: singleton ? new symbol(options) : undefined,
                    };
                }
            }
        }
        // Iterate registry and inject dependencies.
        for (let item of Object.values(SmartDI.registry)) {
            // Fetch metadata;
            if (!item.singleton)
                continue;
            let autowireds = Reflect.getMetadata('smartdi:autowireds', item.singleton);
            if (!autowireds)
                continue;
            // Inject components.
            for (let prop of Object.keys(autowireds)) {
                item.singleton[prop] = SmartDI.get(autowireds[prop].clue, autowireds[prop].options);
            }
        }
    }
    static get(arg, options) {
        return SmartDI.internalGet(arg, options);
    }
    static internalGet(arg, options, creatings) {
        let constructor, name;
        if (typeof arg === 'function') {
            constructor = arg, name = arg.name;
        }
        else {
            constructor = undefined, name = arg;
        }
        // Find by name in resolved components.
        let item = SmartDI.resolved[name];
        // Attempt to resolve by name.
        if (!item)
            item = SmartDI.registry[name];
        // Attempt to resolve by constructor.
        if (!item && constructor)
            item = SmartDI.resolveByConstructor(constructor);
        // Throw an error if not resolved.
        if (!item)
            throw new Error(`Can not resolve component: ${name}`);
        // Cache.
        SmartDI.resolved[name] = item;
        // Return singleton if exist.
        if (item.singleton)
            return item.singleton;
        // Create a new instance.
        let instance = new item.class(options || item.options);
        let autowireds = Reflect.getMetadata('smartdi:autowireds', instance);
        if (!autowireds)
            return instance;
        // Check cirrcular dependencies.
        creatings = creatings || new Set();
        if (creatings.has(item.name))
            throw new Error('Circular dependency detected!');
        // Inject dependencies.
        creatings.add(item.name);
        for (let prop of Object.keys(autowireds))
            instance[prop] = SmartDI.internalGet(autowireds[prop].clue, autowireds[prop].options, creatings);
        // Return instance.
        return instance;
    }
    static resolveByConstructor(constructor) {
        let matched = [], item = undefined;
        function isSubclass(sub, sup) {
            let proto = sub;
            while (sub.name) {
                if (sub === sup)
                    return true;
                sub = sub.__proto__;
            }
            return false;
        }
        // Iterate registry
        for (let entry of Object.values(SmartDI.registry)) {
            // Not an instance of specified class, continue.
            if (!isSubclass(constructor, entry.class))
                continue;
            // Record resolved name and instance.
            matched.push(entry.name);
            item = entry;
        }
        // Throw an error when matched more then on components.
        if (matched.length > 1)
            throw new Error(`Multiple components found for "${constructor.name}": ${matched.join(', ')}`);
        // return result.
        return item;
    }
}
exports.SmartDI = SmartDI;
SmartDI.registry = {};
SmartDI.resolved = {};
SmartDI.autowired = false;
//# sourceMappingURL=index.js.map