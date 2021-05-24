import requireall from 'require-all'
import 'reflect-metadata'

/**
 * Class.
 * 
 */
export type Class<T = any> = { new(arg?: any): T };

/**
 * ComponentOptions.
 *
 */
export type ComponentOptions = { [key: string]: any };

/**
 * Indicates that a decorated class is a "component". Such classes are considered as candidates for DI when scanning.
 *
 * @param name - name of this component(optional)
 *
 */
export function Component(options?: ComponentOptions, multiple?: boolean): ClassDecorator;
export function Component(name: string, multiple?: boolean): ClassDecorator;
export function Component(name: string, options: ComponentOptions, multiple?: boolean): ClassDecorator;
export function Component(arg1?: string | ComponentOptions, arg2?: boolean | ComponentOptions, arg3?: boolean): ClassDecorator {
  return function (target: Function): void {
    let name: string, singleton: boolean, options: ComponentOptions;
    if (typeof arg1 === 'undefined' || typeof arg1 === 'object') {
      name = target.name;
      options = arg1;
      singleton = !arg2;
    } else if (typeof arg2 === 'boolean') {
      name = arg1;
      options = undefined;
      singleton = !arg2;
    } else {
      name = arg1 as string;
      options = arg2 as ComponentOptions;
      singleton = !arg3;
    }

    Reflect.defineMetadata('smartdi:component', name, target);
    Reflect.defineMetadata('smartdi:singleton', singleton, target);
    Reflect.defineMetadata('smartdi:options', options, target);
  }
}

/**
 * Marks a field to be autowired by SmartDI's dependency injection facilities.
 *
 * @param constructor - class or base class of the autowired component
 * @param options - options used to creating new instances.
 *
 */
export function Autowired(constructor: Class, options?: ComponentOptions): PropertyDecorator;
/**
 * Marks a field to be autowired by SmartDI's dependency injection facilities.
 *
 * @param name - name of the autowired component
 * @param options - options used to creating new instances.
 *
 */
export function Autowired(name: string, options?: ComponentOptions): PropertyDecorator;
export function Autowired(arg1: Class | string, options?: ComponentOptions): PropertyDecorator {
  return function (target: Object, prop: string | symbol): void {
    let autowireds = Reflect.getMetadata('smartdi:autowireds', target) || {};
    autowireds[prop] = { clue: arg1, options: options };
    Reflect.defineMetadata('smartdi:autowireds', autowireds, target);
  }
}

/**
 * Options to indicate how SmartDI wire up all components.
 *
 */
export interface AutowireOptions {
  /** built-in components */
  components?: { [key: string]: any };
  /** dirs to scan compoents */
  scans?: Array<string>;
}

interface RegistryItem {
  source: 'scan' | 'built-in';
  name: string;
  class: Class;
  options: ComponentOptions;
  singleton: any;
}

/**
 * Main entry of SmartDI framework.
 *
 */
export class SmartDI {

  public static readonly version: '0.0.1';

  private static readonly registry: { [key: string]: RegistryItem } = {};
  private static readonly resolved: { [key: string]: RegistryItem } = {};

  private static autowired: boolean = false;

  private constructor() {
    throw new Error('Do not instantiate this class.');
  }

  /**
   * Wire up all components according to specified options.
   *
   * @param options - autowire options
   *
   */
  public static autowire(options: AutowireOptions): void {
    if (SmartDI.autowired)
      throw new Error('SmartDI.autowire() can only be called once.');
    SmartDI.autowired = true;

    for (let name of Object.keys(options.components || {})) {
      let component = options.components![name];
      SmartDI.registry[name] = {
        source: 'built-in',
        name: name,
        class: component.constructor,
        options: undefined,
        singleton: component,
      }
    }

    // Iterate all dirs to find and instantiate all components.
    for (let scan of options.scans || []) {
      // Load all modules.
      let modules = requireall({ dirname: scan, filter: /.+\.js$/ });
      // Iterate all modules.
      for (let module of Object.values(modules)) {
        // Iterate all exported symbols
        for (let symbol of Object.values<Class>(module)) {
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
          }
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

  /**
   * Get a component which is a instance of the specified class.
   *
   * @param constructor - class or base class of the compoent
   * @param options - options used to creating new instance.
   *
   */
  public static get<T>(constructor: Class<T>, options?: ComponentOptions): T;
  /**
   * Get a component by name.
   *
   * @param name - name of the compoent
   * @param options - options used to creating new instance.
   *
   */
  public static get(name: string, options?: ComponentOptions): any;
  public static get(arg: Class | string, options?: ComponentOptions): any {
    return SmartDI.internalGet(arg, options);
  }

  private static internalGet(arg: Class | string, options: ComponentOptions, creatings?: Set<string>): any {
    let constructor: Class | undefined, name: string;
    if (typeof arg === 'function') {
      constructor = arg, name = arg.name;
    } else {
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

  private static resolveByConstructor(constructor: Class): RegistryItem {
    let matched: Array<string> = [], item: any = undefined;

    function isSubclass(sub: Class, sup: Class): boolean {
      let proto = sub;
      while (sub.name) {
        if (sub === sup)
          return true;
        sub = (sub as any).__proto__;
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
