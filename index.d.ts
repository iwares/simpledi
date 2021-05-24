import 'reflect-metadata';
/**
 * Class.
 *
 */
export declare type Class<T = any> = {
    new (arg?: any): T;
};
/**
 * ComponentOptions.
 *
 */
export declare type ComponentOptions = {
    [key: string]: any;
};
/**
 * Indicates that a decorated class is a "component". Such classes are considered as candidates for DI when scanning.
 *
 * @param name - name of this component(optional)
 *
 */
export declare function Component(options?: ComponentOptions, multiple?: boolean): ClassDecorator;
export declare function Component(name: string, multiple?: boolean): ClassDecorator;
export declare function Component(name: string, options: ComponentOptions, multiple?: boolean): ClassDecorator;
/**
 * Marks a field to be autowired by SmartDI's dependency injection facilities.
 *
 * @param constructor - class or base class of the autowired component
 * @param options - options used to creating new instances.
 *
 */
export declare function Autowired(constructor: Class, options?: ComponentOptions): PropertyDecorator;
/**
 * Marks a field to be autowired by SmartDI's dependency injection facilities.
 *
 * @param name - name of the autowired component
 * @param options - options used to creating new instances.
 *
 */
export declare function Autowired(name: string, options?: ComponentOptions): PropertyDecorator;
/**
 * Options to indicate how SmartDI wire up all components.
 *
 */
export interface AutowireOptions {
    /** built-in components */
    components?: {
        [key: string]: any;
    };
    /** dirs to scan compoents */
    scans?: Array<string>;
}
/**
 * Main entry of SmartDI framework.
 *
 */
export declare class SmartDI {
    static readonly version: '0.0.1';
    private static readonly registry;
    private static readonly resolved;
    private static autowired;
    private constructor();
    /**
     * Wire up all components according to specified options.
     *
     * @param options - autowire options
     *
     */
    static autowire(options: AutowireOptions): void;
    /**
     * Get a component which is a instance of the specified class.
     *
     * @param constructor - class or base class of the compoent
     * @param options - options used to creating new instance.
     *
     */
    static get<T>(constructor: Class<T>, options?: ComponentOptions): T;
    /**
     * Get a component by name.
     *
     * @param name - name of the compoent
     * @param options - options used to creating new instance.
     *
     */
    static get(name: string, options?: ComponentOptions): any;
    private static internalGet;
    private static resolveByConstructor;
}
