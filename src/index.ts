import { _NanoSQLDB } from "./db-index";
import { Promise } from "lie-ts";

declare var global: any;

export interface UUID extends String {

}

// tslint:disable-next-line
export interface timeId extends String {

}

// tslint:disable-next-line
export interface timeIdms extends String {

}

/**
 * Standard object placeholder with string key.
 *
 * @export
 * @interface StdObject
 * @template T
 */
export interface StdObject<T> {
    [key: string]: T;
}

/**
 * Custom functinos for the database.
 *
 * @export
 * @interface DBFunction
 */
export interface DBFunction {
    call: (row: DBRow, args: string[], ptr: number[], prev?: any) => DBRow[];
    type: "aggregate"|"simple";
}

/**
 * This is the format used for actions and views
 *
 * @export
 * @interface ActionOrView
 */
export interface ActionOrView {
    name: string;
    args?: Array<string>;
    extend?: any;
    call: (args?: any, db?: NanoSQLInstance) => Promise<any>;
}

/**
 * You need an array of these to declare a data model.
 *
 * @export
 * @interface DataModel
 */
export interface DataModel {
    key: string;
    type: "string"|"int"|"float"|"array"|"map"|"bool"|"uuid"|"blob"|string;
    default?: any;
    props?: Array<any>;
}


/**
 * Used to represent a single query command.
 *
 * @export
 * @interface QueryLine
 */
export interface QueryLine {
    type: string;
    args?: any;
}

/**
 * Returned by the event listener when it's called.
 *
 * @export
 * @interface DatabaseEvent
 */
export interface DatabaseEvent {
    table: string;
    query: Array<QueryLine>;
    time: number;
    result: Array<any>;
    name: "change"|"delete"|"upsert"|"drop"|"select"|"error";
    actionOrView: string;
    changeType: string;
    changedRows: DBRow[];
}

/**
 * The arguments used for the join command.
 *
 * Type: join type to use
 * Query: A select query to use for the right side of the join
 * Where: Conditions to use to merge the data
 *
 * @export
 * @interface JoinArgs
 */
export interface JoinArgs {
    type: "left"|"inner"|"right"|"cross"|"outer";
    table: string;
    where?: Array<string>;
}

/**
 *  A single database row.
 *
 * @export
 * @interface DBRow
 */
export interface DBRow {
    [key: string]: any;
}

export const _assign = (obj: any) => {
    return JSON.parse(JSON.stringify(obj));
};

export interface IActionViewMod {
    (tableName: string, actionOrView: "Action"|"View", name: string, args: any, complete: (args: any) => void, error?: (errorMessage: string) => void): void;
}

/**
 * The primary abstraction class, there is no database implimintation code here.
 * Just events, quries and filters.
 *
 * @export
 * @class NanoSQLInstance
 */
export class NanoSQLInstance {


    /**
     * Holds the current selected table
     *
     * @internal
     * @type {string}
     * @memberOf NanoSQLInstance
     */
    private _selectedTable: string;

    /**
     * The backend currently being used
     *
     * @public
     * @type {NanoSQLBackend}
     * @memberOf NanoSQLInstance
     */
    public backend: NanoSQLBackend;

    /**
     * Misc placeholder that can be used by the dev.
     *
     * @type {*}
     * @memberOf NanoSQLInstance
     */
    public data: any;

    /**
     * The callbacks for events
     *
     * @internal
     * @type {StdObject<StdObject<Array<Function>>>}
     * @memberOf NanoSQLInstance
     */
    private _callbacks: StdObject<StdObject<Array<Function>>>;

    /**
     * An array of possible events
     *
     * @internal
     * @type {Array<string>}
     * @memberOf NanoSQLInstance
     */
    private _events: Array<string>;

    /**
     * Holds a map of the current views for this database.
     *
     * @internal
     * @type {StdObject<Array<ActionOrView>>}
     * @memberOf NanoSQLInstance
     */
    private _views: StdObject<Array<ActionOrView>>;

    /**
     * Holds a map of the current actions for this database.
     *
     * @internal
     * @type {StdObject<Array<ActionOrView>>}
     * @memberOf NanoSQLInstance
     */
    private _actions: StdObject<Array<ActionOrView>>;


    /**
     * A map containing the models
     *
     * @internal
     * @type {StdObject<Array<DataModel>>}
     * @memberOf NanoSQLInstance
     */
    public _models: StdObject<Array<DataModel>>;

    /**
     * An array containing a temporary list of events to trigger
     *
     * @internal
     * @type {Array<"change"|"delete"|"upsert"|"drop"|"select"|"error">}
     * @memberOf NanoSQLInstance
     */
    public _triggerEvents: Array<"change"|"delete"|"upsert"|"drop"|"select"|"error"|string>;

    /**
     * Stores wether each table has events attached to it or not.
     *
     * @public
     * @type {StdObject<boolean>}
     * @memberOf NanoSQLInstance
     */
    public _hasEvents: StdObject<boolean>;

    /**
     * The current action or view being triggered.
     *
     * @internal
     * @type {string}
     * @memberOf NanoSQLInstance
     */
    public _activeAV: string|undefined;

    /**
     * Holds custom filters implimented by the user
     *
     * @private
     *
     * @memberOf NanoSQLInstance
     */
    private _functions: {
        [key: string]:  DBFunction
    };

    /**
     * Holds an array of custom commands, this is used if the custom() is used before we connect to the db.
     *
     * @internal
     * @type {Array<Array<any>>}
     * @memberOf NanoSQLInstance
     */
    private _preConnectExtend: Array<Array<any>>;

    /**
     * Holds an object containing the insert filters.
     *
     * @internal
     *
     * @memberOf NanoSQLInstance
     */
    private _rowFilters: {
        [key: string]: (row: any) => any;
    };

    /**
     * Lets you modify queries before they run on the database
     *
     * @internal
     *
     * @memberOf NanoSQLInstance
     */
    public _queryMod: (args: DBExec, complete: (args: DBExec) => void) => void;

    /**
     * Holds a reference to the optional action/view modifier
     *
     *
     * @memberOf NanoSQLInstance
     */
    public _AVMod: IActionViewMod;

    /**
     * Flag to indicate if a transaction is in progress or not.
     *
     * @type {boolean}
     * @memberOf NanoSQLInstance
     */
    public doingTransaction: boolean;

    /**
     * The current timezone offset of this system.
     *
     * @private
     * @type {number}
     * @memberOf NanoSQLInstance
     */
    private static _tzOffset: number;


    /**
     * Store an array of updated tables to decide what tables to trigger a change on after the transaction.
     * 
     * @private
     * @type {string[]}
     * @memberOf NanoSQLInstance
     */
    private _transactionTables: string[];

    constructor() {

        let t = this;
        t._actions = {};
        t._views = {};
        t._models = {};
        t._preConnectExtend = [];
        t._transactionTables = [];
        t._events = ["change", "delete", "upsert", "drop", "select", "error"];

        t._callbacks = {};
        t._hasEvents = {};
        t._callbacks["*"] = {};
        let i = t._events.length;
        while (i--) {
            t._callbacks["*"][t._events[i]] = [];
        }

        t._functions = {};
        t._rowFilters = {};
    }


    /**
     * Changes the table pointer to a new table.
     *
     * @param {string} [table]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public table(table?: string): NanoSQLInstance {
        if (table) this._selectedTable = table;
        return this;
    }

    /**
     * Inits the backend database for use.
     *
     * Optionally include a custom database driver, otherwise the built in memory driver will be used.
     *
     * @param {NanoSQLBackend} [backend]
     * @returns {(Promise<Object | string>)}
     *
     * @memberOf NanoSQLInstance
     */
    public connect(backend?: NanoSQLBackend): Promise<Object | string> {
        let t = this;

        if (t.backend) {
            return new Promise((res, rej) => {
                rej();
                throw Error();
            });
        }
        t.backend = backend || new _NanoSQLDB();
        return new Promise((res, rej) => {
            t.backend._connect({
                _models: t._models,
                _actions: t._actions,
                _views: t._views,
                _functions: t._functions,
                _config: t._preConnectExtend,
                _parent: this,
                _onSuccess: (result: any) => {
                    res(result, t);
                },
                _onFail: (rejected: any) => {
                    if (rej) rej(rejected, t);
                }
            });
        });
    }

    /**
     * Adds an event listener to the selected database table.
     *
     * @param {("change"|"delete"|"upsert"|"drop"|"select"|"error")} actions
     * @param {Function} callBack
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public on(actions: "change"|"delete"|"upsert"|"drop"|"select"|"error", callBack: (event: DatabaseEvent, database: NanoSQLInstance) => void): NanoSQLInstance {
        let t = this;
        let l = t._selectedTable;
        let i = 0;
        let a = actions.split(" ");

        if (!t._callbacks[l]) { // Handle the event handler being called before the database has connected
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }

        i = a.length;
        while (i--) {
            if (t._events.indexOf(a[i]) !== -1) {
                t._callbacks[l][a[i]].push(callBack);
            }
        }
        t._refreshEventChecker();
        return t;
    }

	/**
	 * Remove a specific event handler from being triggered anymore.
	 *
	 * @param {Function} callBack
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public off(callBack: Function): NanoSQLInstance {
        let t = this;
        for (let key in t._callbacks) {
            for (let key2 in t._callbacks[key]) {
                t._callbacks[key][key2] = t._callbacks[key][key2].filter((cBs) => {
                    return cBs !== callBack;
                });
            }
        }
        t._refreshEventChecker();
        return t;
    }

    private _refreshEventChecker() {
        this._hasEvents = {};
        Object.keys(this._models).concat(["*"]).forEach((table) => {
            this._hasEvents[table] = this._events.reduce((prev, cur) => {
                return prev + (this._callbacks[table] ? this._callbacks[table][cur].length : 0);
            }, 0) > 0;
        });
    }

	/**
	 * Declare the data model for the current selected table.
     *
     * Please reference the DataModel interface for how to impliment this, a quick example:
     *
     * ```ts
     * .model([
     *  {key:"id",type:"int",props:["ai","pk"]} //auto incriment and primary key
     *  {key:"name",type:"string"}
     * ])
     * ```
	 *
	 * @param {Array<DataModel>} dataModel
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public model(dataModel: Array<DataModel>): NanoSQLInstance {
        let t = this;
        let l = t._selectedTable;
        let i = t._events.length;
        if (!t._callbacks[l]) {
            t._callbacks[l] = {};
            t._callbacks[l]["*"] = [];
            while (i--) {
                t._callbacks[l][t._events[i]] = [];
            }
        }
        t._models[l] = dataModel;
        t._views[l] = [];
        t._actions[l] = [];
        return t;
    }

	/**
	 * Declare the views for the current selected table.  Must be called before connect()
     *
     * Views are created like this:
     *
     * ```ts
     * .views([
     *  {
     *      name:"view-name",
     *      args: ["array","of","arguments"],
     *      call: function(args) {
     *          // Because of our "args" array the args input of this function will look like this:
     *          // NanoSQL will not let any other arguments into this function.
     *          args:{
     *              array:'',
     *              of:'',
     *              arguments:''
     *          }
     *          //We can use them in our query
     *          return this.query('select').where(['name','IN',args.array]).exec();
     *      }
     *  }
     * ])
     * ```
     *
     * Then later in your app..
     *
     * ```ts
     * NanoSQL("users").getView("view-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     *
     * ```ts
     * .views[{
     *      name:...
     *      args:["name:string","balance:float","active:bool"]
     *      call:...
     * }]
     * ```
     *
     * NanoSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
	 *
	 * @param {Array<ActionOrView>} viewArray
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public views(viewArray: Array<ActionOrView>): NanoSQLInstance {
        return this._views[this._selectedTable] = viewArray, this;
    }

    /**
     * Execute a specific view.  Refernece the "views" function for more description.
     *
     * Example:
     * ```ts
     * NanoSQL("users").getView('view-name',{foo:"bar"}).then(function(result) {
     *  console.log(result) <== view result.
     * })
     * ```
     *
     * @param {string} viewName
     * @param {any} viewArgs
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public getView(viewName: string, viewArgs: any = {}): Promise<Array<any>|NanoSQLInstance> {
        return this._doAV("View", this._views[this._selectedTable], viewName, viewArgs);
    }

    /**
     * Take an action or view and it's args, then make sure the args comform to the types declared in the model.
     *
     * @public
     * @param {Array<string>} argDeclarations
     * @param {Object} args
     * @returns {Object}
     *
     * @memberOf NanoSQLInstance
     */
    public cleanArgs(argDeclarations: Array<string>, args: StdObject<any>): StdObject<any> {
        let t = this;
        let l = t._selectedTable;
        let a: StdObject<any> = {};
        let i = argDeclarations.length ? argDeclarations.length : -1;
        if (i > 0) {
            while (i--) {
                let k2: Array<string> = argDeclarations[i].split(":");
                if (k2.length > 1) {
                    a[k2[0]] = t._cast(k2[1], args[k2[0]] || null);
                } else {
                    a[k2[0]] = args[k2[0]] || null;
                }
            }
        }

        return a;
    }

    /**
     * Cast variables to a specific type.
     *
     * @internal
     * @param {string} type
     * @param {*} val
     * @returns {*}
     *
     * @memberOf NanoSQLInstance
     */
    private _cast(type: string, val?: any): any {
        const t = typeof val;
        let types: object = {
            string: t !== "string" ? String(val) : val,
            int: t !== "number" || val % 1 !== 0 ? parseInt(val || 0) : val,
            float: t !== "number" ? parseFloat(val || 0) : val,
            array: Array.isArray(val) ? _assign(val || []) : [],
            "any[]": Array.isArray(val) ? _assign(val || []) : [],
            any: val,
            blob: val,
            uudi: val,
            timeId: val,
            map: t === "object" ? _assign(val || {}) : {},
            bool: val === true
        };
        const newVal = types[type];
        if (newVal !== undefined) {
            return newVal;
        } else if (type.indexOf("[]") !== -1) {
            const arrayOf = type.slice(0, type.lastIndexOf("[]"));
            return (val || []).map((v) => {
                return this._cast(arrayOf, v);
            });
        }
        return val;
    }

	/**
	 * Declare the actions for the current selected table.  Must be called before connect()
     *
     * Actions are created like this:
     * ```ts
     * .actions([
     *  {
     *      name:"action-name",
     *      args: ["array","of","arguments"],
     *      call: function(args) {
     *          // Because of our "args" array the args input of this function will look like this:
     *          // NanoSQL will not let any other arguments into this function.
     *          args:{
     *              array:'',
     *              of:'',
     *              arguments:''
     *          }
     *          //We can use them in our query
     *          return this.query("upsert",{balance:0}).where(['name','IN',args.array]).exec();
     *      }
     *  }
     * ])
     * ```
     *
     * Then later in your app..
     *
     * ```ts
     * NanoSQL("users").doAction("action-name",{array:'',of:"",arguments:""}).then(function(result) {
     *  console.log(result) <=== result of your view will be there.
     * })
     * ```
     *
     * Optionally you can type cast the arguments at run time typescript style, just add the types after the arguments in the array.  Like this:
     * ```ts
     * .actions[{
     *      name:...
     *      args:["name:string","balance:float","active:bool"]
     *      call:...
     * }]
     * ```
     *
     * NanoSQL will force the arguments passed into the function to those types.
     *
     * Possible types are string, bool, float, int, map, array and bool.
	 *
	 * @param {Array<ActionOrView>} actionArray
	 * @returns {NanoSQLInstance}
	 *
	 * @memberOf NanoSQLInstance
	 */
    public actions(actionArray: Array<ActionOrView>): NanoSQLInstance {
        return this._actions[this._selectedTable] = actionArray, this;
    }

    /**
     * Init an action for the current selected table. Reference the "actions" method for more info.
     *
     * Example:
     * ```ts
     * NanoSQL("users").doAction('action-name',{foo:"bar"}).then(function(result) {
     *      console.log(result) <== result of your action
     * });
     * ```
     *
     * @param {string} actionName
     * @param {any} actionArgs
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public doAction(actionName: string, actionArgs: any): Promise<Array<DBRow>|NanoSQLInstance> {
        return this._doAV("Action", this._actions[this._selectedTable], actionName, actionArgs);
    }

    /**
     * Internal function to fire action/views.
     *
     * @private
     * @param {("Action"|"View")} AVType
     * @param {ActionOrView[]} AVList
     * @param {string} AVName
     * @param {*} AVargs
     * @returns {(Promise<Array<DBRow>|NanoSQLInstance>)}
     *
     * @memberOf NanoSQLInstance
     */
    private _doAV(AVType: "Action"|"View", AVList: ActionOrView[], AVName: string, AVargs: any): Promise<Array<DBRow>|NanoSQLInstance> {
       let t = this;

        let selAV: ActionOrView|null = AVList.reduce((prev, cur) => {
            if (cur.name === AVName) return cur;
            return prev;
        }, null as any);

        if (!selAV) {
            return new Promise((res, rej) => rej("Action/View Not Found!"));
        }
        t._activeAV = AVName;

        let cleanArgs = selAV.args ? t.cleanArgs(selAV.args, AVargs) : {};

        if (t._AVMod) {
            return new Promise((res, rej) => {
                t._AVMod(this._selectedTable, AVType, t._activeAV || "", cleanArgs, (args) => {
                    selAV ? selAV.call(args, t).then((result) => {
                        res(result, t);
                    }) : false;
                }, (err) => {
                    rej(err);
                });
            });
        } else {
            return selAV.call(cleanArgs, t);
        }
    }

    /**
	 * Add a function to the usable list of functions for this database.  Must be called BEFORE connect().
     *
     * Functions can be used with any database on the attached store.
     *
     * Example:
     *
     * ```ts
     * NanoSQL().newFunction('ADD',{ // Function is called "ADD"
     *  type:"simple", // "aggregate" or "simple"
     *  call:function(row:DBRow, args: string[], ptr: number[], prev: any) {
     *      // arguments are passed in as an array in the args argument.
     *      // ptr is an array that lets you know the length and position of the current query.
     *      // ptr[0] is the current index, ptr[1] is the max index/length
     *      // prev is only used for aggregate functions, lets  you pass an argument into the next function call.
     *      let r = JSON.parse(JSON.stringify(row));
     *      r.ADD = args.reduce((a, b) => parseFloat(a) + parseFloat(b));
     *      return r;
     *  }
     * });
     * ```
     *
     * Then to use it in a query:
     * ```ts
     * NanoSQL("users").query("select",["name","ADD(balance, 2)"]).exec();
	 * ```
     *
     * Make sure the calculated value is add to the row(s) with the `useKey` argument, otherwise `AS` arguments won't work.
     *
     * @param {string} filterName
     * @param {(rows: Array<Object>) => Array<Object>} filterFunction
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public newFunction(functionName: string, functionType: "aggregate"|"simple", filterFunction: (row: DBRow, args: string[], ptr: number[], prev?: any) => DBRow[]): NanoSQLInstance {
        return this._functions[functionName] = {type: functionType, call: filterFunction}, this;
    }

    /**
     * Start a query into the current selected table.
     * Possibl querys are "select", "upsert", "delete", and "drop";
     *
     * ### Select
     *
     * Select is used to pull a set of rows or other data from the table.
     * When you use select the optional second argument of the query is an array of strings that allow you to show only specific columns.
     *
     * Examples:
     * ```ts
     * .query("select") // No arguments, select all columns
     * .query("select",['username']) // only get the username column
     * .query("select",["username","balance"]) //Get two columns, username and balance.
     * .query("select",["count(*)"]) //Get the length of records in the database
     * ```
     *
     * ### Upsert
     *
     * Upsert is used to add or modify data in the database.
     * If the primary key rows are null or undefined, the data will always be added in a new row. Otherwise, you might be updating existing rows.
     * The second argument of the query with upserts is always an Object of the data to upsert.
     *
     * Examples:
     * ```ts
     * .query("upsert",{id:1, username:"Scott"}) //If row ID 1 exists, set the username to scott, otherwise create a new row with this data.
     * .query("upsert",{username:"Scott"}) //Add a new row to the db with this username in the row.
     * .query("upsert",{balance:-35}).where(["balance","<",0]) // If you use a WHERE statement this data will be applied to the rows found with the where statement.
     * ```
     *
     * ### Delete
     *
     * Delete is used to remove data from the database.
     * It works exactly like select, except it removes data instead of selecting it.  The second argument is an array of columns to clear.  If no second argument is passed, the entire row is deleted.
     * If no where argument is passed, the entire table is dropped
     *
     * Examples:
     * ```ts
     * .query("delete",['balance']) //Clear the contents of the balance column on ALL rows.
     * .query("delete",['comments']).where(["accountType","=","spammer"]) // If a where statment is passed you'll only clear the columns of the rows selected by the where statement.
     * .query("delete").where(["balance","<",0]) // remove all rows with a balance less than zero
     * .query("delete") // Same as drop statement
     * ```
     *
     * ### Drop
     *
     * Drop is used to completely clear the contents of a database.  There are no arguments.
     *
     * Drop Examples:
     * ```ts
     * .query("drop")
     * ```
     *
     * @param {("select"|"upsert"|"delete"|"drop")} action
     * @param {any} [args]
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public query(action: "select"|"upsert"|"delete"|"drop"|"show tables"|"describe", args?: any): _NanoSQLQuery {

        let t = this;
        let query = new _NanoSQLQuery(t._selectedTable, t, t._activeAV);
        t._activeAV = undefined;
        const a = action.toLowerCase();
        if (["select", "upsert", "delete", "drop", "show tables", "describe"].indexOf(a) !== -1) {

            let newArgs = args || (a === "select" || a === "delete" ? [] : {});
            if (["upsert", "delete", "drop"].indexOf(a) !== -1) {
                this._transactionTables.push(t._selectedTable);
            }

            if (action === "upsert") {
                // Cast row types and remove columns that don't exist in the data model
                let inputArgs = {};
                t._models[t._selectedTable].forEach((model) => {
                    if (newArgs[model.key]) {
                        inputArgs[model.key] = t._cast(model.type, newArgs[model.key]);
                    }
                });

                // Apply insert filters
                if (t._rowFilters[t._selectedTable]) {
                    inputArgs = t._rowFilters[t._selectedTable](inputArgs);
                }
                newArgs = inputArgs;
            }

            query._action = {type: a, args: newArgs};
        } else {
            throw Error;
        }
        return query;
    }

    /**
     * Trigger a database event
     *
     * @param {DatabaseEvent} eventData
     *
     * @memberOf NanoSQLInstance
     */
    public triggerEvent(eventData: DatabaseEvent, triggerEvents: Array<string>): void {
        let t = this;
        setTimeout(() => {
            let i = triggerEvents.length;
            let j = 0;
            let e: any;
            let c: Array<Function>;
            while (i--) {
                e = triggerEvents[i];
                c = t._callbacks[eventData.table][e].concat(t._callbacks[eventData.table]["*"]);
                j = c.length;
                while (j--) {
                    eventData.name = e;
                    c[j](eventData, t);
                }
            }
        }, 0);
    }

    /**
     * Returns a default object for the current table's data model, useful for forms.
     *
     * The optional argument lets you pass in an object to over write the data model's defaults as desired.
     *
     * Examples:
     *
     * ```ts
     * console.log(NanoSQL("users").default()) <= {username:"none", id:undefined, age: 0}
     * console.log(NanoSQL("users").default({username:"defalt"})) <= {username:"default", id:undefined, age: 0}
     * ```
     *
     * DO NOT use this inside upsert commands like `.query("upsert",NanoSQL("users").defalt({userObj}))..`.
     * The database defaults are already applied through the upsert path, you'll be doing double work.
     *
     * Only use this to pull default values into a form in your UI or similar situation.
     *
     * @param {*} [replaceObj]
     * @returns {{[key: string]: any}}
     *
     * @memberOf NanoSQLInstance
     */
    public default(replaceObj?: any): {[key: string]: any} {
        let newObj = {};
        let t = this;
        t._models[t._selectedTable].forEach((m) => {
            newObj[m.key] = (replaceObj && replaceObj[m.key]) ? replaceObj[m.key] : m.default;
            if (!newObj[m.key]) {
                newObj[m.key] = t._cast(m.type, null); // Generate default value from type, eg int == 0
            }
        });
        return newObj;
    }

    /**
     * Start a database transaction, useful for importing large amounts of data.
     *
     *
     * @memberOf NanoSQLInstance
     */
    public beginTransaction() {
        this.doingTransaction = true;
        this._transactionTables = [];
        if (this.backend._transaction) return this.backend._transaction("start");
    }

    /**
     * End a database transaction.
     *
     *
     * @memberOf NanoSQLInstance
     */
    public endTransaction() {
        this.doingTransaction = false;
        this._transactionTables.forEach((table) => {
            if (table.indexOf("_") !== 0) {
                this.triggerEvent({
                    table: table,
                    query: [],
                    time: new Date().getTime(),
                    result: [],
                    name: "change",
                    actionOrView: "",
                    changeType: "transaction",
                    changedRows: []
                }, ["change"]);
            }
        });
        if (this.backend._transaction) return this.backend._transaction("end");
    }

    /**
     * Adds a query filter to every request.
     *
     * @param {(args: DBExec, complete:(args: DBExec) => void) => void} callBack
     *
     * @memberOf NanoSQLInstance
     */
    public queryFilter(callBack: (args: DBExec, complete: (args: DBExec) => void) => void): NanoSQLInstance {
        this._queryMod = callBack;
        return this;
    }


    /**
     * Set the action/view filter function.  Called *before* the action/view is sent to the datastore
     *
     * @param {IActionViewMod} filterFunc
     * @returns
     *
     * @memberOf NanoSQLInstance
     */
    public avFilter(filterFunc: IActionViewMod) {
        this._AVMod = filterFunc;
        return this;
    }

    /**
     * Configure the database driver, must be called before the connect() method.
     *
     * @param {any} args
     * @returns {NanoSQLInstance}
     *
     * @memberOf NanoSQLInstance
     */
    public config(args: any): NanoSQLInstance {
        let t = this;
        if (!t.backend) t._preConnectExtend.push(args);
        return t;
    }

    /**
     * Perform a custom action supported by the database driver.
     *
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf NanoSQLInstance
     */
    public extend(...args: Array<any>): any|NanoSQLInstance {
        let t = this;

        if (t.backend) { // Query Mode
            if (t.backend._extend) {
                args.unshift(t);
                return t.backend._extend.apply(t.backend, args);
            } else {
                return undefined;
            }
        }
    }

    /**
     * Load JSON directly into the DB.
     * JSON must be an array of maps, like this:
     * ```ts
     * [
     *  {"name":"billy","age":20},
     *  {"name":"johnny":"age":30}
     * ]
     * ```
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {Array<Object>} rows
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public loadJS(table: string, rows: Array<Object>): Promise<Array<Object>> {
        let t = this;
        t.beginTransaction();
        return new Promise((res, rej) => {
            let pointer = 0;
            let rowData: any[] = [];
            const next = () => {
                if (pointer < rows.length) {
                    if (rows[pointer]) {
                        t.table(table).query("upsert", rows[pointer]).exec().then((res) => {
                            rowData.push(res);
                            pointer++;
                            next();
                        });
                    } else {
                        pointer++;
                        next();
                    }
                } else {
                    t.endTransaction();
                    res(rowData, t);
                }
            };
            next();
        });
    }

    /**
     * Adds a filter to rows going into the database, allows you to control the range and type of inputs.
     *
     * This function will be called on every upsert and you'll recieve the upsert data as it's being passed in.
     *
     * NanoSQL will apply the "default" row data to each column and type cast each column BEFORE calling this function.
     *
     * @param {(row: object) => object} callBack
     *
     * @memberOf NanoSQLInstance
     */
    public rowFilter(callBack: (row: any) => any) {
        return this._rowFilters[this._selectedTable] = callBack, this;
    }

    /**
     * Load a CSV file into the DB.  Headers must exist and will be used to identify what columns to attach the data to.
     *
     * This function performs a bunch of upserts, so expect appropriate behavior based on the primary key.
     *
     * Rows must align with the data model.  Row data that isn't in the data model will be ignored.
     *
     * @param {string} csv
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public loadCSV(table: string, csv: string): Promise<Array<Object>> {
        let t = this;
        let fields: Array<string> = [];
        t.beginTransaction();
        return new Promise((res, rej) => {
            Promise.all(csv.split("\n").map((v, k) => {
                return new Promise((resolve, reject) => {
                    if (k === 0) {
                        fields = v.split(",");
                        resolve();
                    } else {
                        let record: StdObject<any> = {};
                        let row = v.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || [];
                        row = row.map(str => str.replace(/^"(.+(?="$))"$/, "$1"));
                        let i = fields.length;
                        while (i--) {
                            if (row[i].indexOf("{") === 0 || row[i].indexOf("[") === 0) {
                                row[i] = JSON.parse(row[i].replace(/'/g, ""));
                            }
                            record[fields[i]] = row[i];
                        }
                        t.table(table).query("upsert", record).exec().then(() => {
                            resolve();
                        });
                    }
                });
            })).then(function () {
                t.endTransaction();
                res([], t);
            });
        });
    }

    private static _random16Bits(): number {
        if (typeof crypto === "undefined") {
            return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
        } else {
            if (crypto.getRandomValues) { // Browser crypto
                let buf = new Uint16Array(1);
                crypto.getRandomValues(buf);
                return buf[0];
            } else if (global !== "undefined" && global._crypto.randomBytes) { // NodeJS crypto
                return  global._crypto.randomBytes(2).reduce((prev: number, cur: number) => cur * prev);
            } else {
                return Math.round(Math.random() * Math.pow(2, 16)); // Less random fallback.
            }
        }
    }

    /**
     * Generate a unique, sortable time ID
     *
     * @static
     * @returns {string}
     *
     * @memberOf NanoSQLInstance
     */
    public static timeid(ms?: boolean): string {
        let t = this;
        if (!t._tzOffset) {
            t._tzOffset = new Date().getTimezoneOffset() * 60000; // In milliseconds
        }
        let time = Math.round((new Date().getTime() + t._tzOffset) / (ms ? 1 : 1000)).toString();
        while (time.length < (ms ? 13 : 10)) {
            time = "0" + time;
        }
        return time + "-" +  (t._random16Bits() + t._random16Bits()).toString(16);
    }

    /**
     * RFC4122 compliant UUID v4, 9 randomly generated 16 bit numbers.
     *
     * @static
     * @returns {string}
     *
     * @memberOf NanoSQLInstance
     */
    public static uuid(): string {
        let r, s, b = "";
        return [b, b, b, b, b, b, b, b, b].reduce((prev: string, cur: any, i: number): string => {
            r = this._random16Bits();
            s = (i === 4 ? i : (i === 5 ? (r % 16 & 0x3 | 0x8).toString(16) : b));
            r = r.toString(16);
            while (r.length < 4) r = "0" + r;
            return prev + ([3, 4, 5, 6].indexOf(i) >= 0 ? "-" : b) + (s + r).slice(0, 4);
        }, b);
    };

    /**
     * Utility function for generating numerical hashes from strings.
     *
     * @internal
     * @param {string} key
     * @returns {number}
     *
     * @memberOf _NanoSQLDB
     */
    public static _hash(key: string): number {
        return Math.abs(key.split("").reduce(function (prev, next, i) {
            return ((prev << 5) + prev) + key.charCodeAt(i);
        }, 0));
    }

}

// tslint:disable-next-line
export class _NanoSQLQuery {

    private _db: NanoSQLInstance;

    public _action: {
        type: string;
        args: any;
    };

    public _modifiers: any[];

    public _table: string;

    public _error: string;

    public _AV: string;

    constructor(table: string, db: NanoSQLInstance, actionOrView?: string) {
        this._db = db;
        this._modifiers = [];
        this._table = table;
        this._AV = actionOrView || "";
    }


    /**
     * Used to select specific rows based on a set of conditions.
     * You can pass in a single array with a conditional statement or an array of arrays seperated by "and", "or" for compound selects.
     * A single where statement has the column name on the left, an operator in the middle, then a comparison on the right.
     *
     * Where Examples:
     *
     * ```ts
     * .where(['username','=','billy'])
     * .where(['balance','>',20])
     * .where(['catgory','IN',['jeans','shirts']])
     * .where([['name','=','scott'],'and',['balance','>',200]])
     * .where([['id','>',50],'or',['postIDs','IN',[12,20,30]],'and',['name','LIKE','Billy']])
     * ```
     *
     * @param {(Array<any|Array<any>>)} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public where(args: Array<any|Array<any>>): _NanoSQLQuery {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Where condition requires an array!";
        }
        return this._addCmd("where", args);
    }

    /**
     * Query to get a specific range of rows very efficiently.
     *
     * @param {number} limit
     * @param {number} offset
     * @returns
     *
     * @memberOf _NanoSQLQuery
     */
    public range(limit: number, offset: number) {
        return this._addCmd("range", [limit, offset]);
    }

    /**
     * Order the results by a given column or columns.
     *
     * Examples:
     *
     * ```ts
     * .orderBy({username:"asc"}) // order by username column, ascending
     * .orderBy({balance:"desc",lastName:"asc"}) // order by balance descending, then lastName ascending.
     * ```
     *
     * @param {Object} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public orderBy(args: {[key: string]: "asc"|"desc"}): _NanoSQLQuery {
        return this._addCmd("orderby", args);
    }

    /**
     * Group By command, typically used with an aggregate function.
     *
     * Example:
     *
     * ```ts
     * NanoSQL("users").query("select",["favoriteColor","count(*)"]).groupBy({"favoriteColor":"asc"}).exec();
     * ```
     *
     * This will provide a list of all favorite colors and how many each of them are in the db.
     *
     * @param {({[key: string]:"asc"|"desc"})} columns
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public groupBy(columns: {[key: string]: "asc"|"desc"}): _NanoSQLQuery {
        return this._addCmd("groupby", columns);
    }

    /**
     * Having statement, used to filter Group BY statements. Syntax is identical to where statements.
     *
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public having(args: Array<any|Array<any>>): _NanoSQLQuery {
        if (!args.length || !Array.isArray(args)) {
            this._error = "Having condition requires an array!";
        }
        return this._addCmd("having", args);
    }

    /**
     * Join command.
     *
     * Example:
     *
     * ```ts
     *  NanoSQL("orders")
     *  .query("select", ["orders.id","orders.title","users.name"])
     *  .where(["orders.status","=","complete"])
     *  .orderBy({"orders.date":"asc"})
     *  .join({
     *      type:"inner",
     *      table:"users",
     *      where:["orders.customerID","=","user.id"]
     *  }).exec();
     *```
     * A few notes on the join command:
     * 1. You muse use dot notation with the table names in all "where", "select", "orderby", and "groupby" arguments.
     * 2. Possible join types are `inner`, `left`, `right`, and `outer`.
     * 3. The "table" argument lets you determine the data on the right side of the join.
     * 4. The "where" argument lets you set what conditions the tables are joined on.
     *
     *
     *
     * @param {JoinArgs} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public join(args: JoinArgs): _NanoSQLQuery {
        if (!args.table || !args.type) {
            this._error = "Join command requires table and type arguments!";
        }
        return this._addCmd("join", args);
    }

    /**
     * Limits the result to a specific amount.  Example:
     *
     * ```ts
     * .limit(20) // Limit to the first 20 results
     * ```
     *
     * @param {number} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public limit(args: number): _NanoSQLQuery {
        return this._addCmd("limit", args);
    }

    /**
     * Perform a trie search on a trie column.
     *
     * @param {string} stringToSearch
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public trieSearch(column: string, stringToSearch: string): _NanoSQLQuery {
        return this._addCmd("trie", [column, stringToSearch]);
    }

    /**
     * Offsets the results by a specific amount from the beginning.  Example:
     *
     * ```ts
     * .offset(10) // Skip the first 10 results.
     * ```
     *
     * @param {number} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    public offset(args: number): _NanoSQLQuery {
        return this._addCmd("offset", args);
    }

    /**
     * Used to add a command to the query
     *
     * @internal
     * @param {string} type
     * @param {(any)} args
     * @returns {_NanoSQLQuery}
     *
     * @memberOf _NanoSQLQuery
     */
    private _addCmd(type: string, args: any): _NanoSQLQuery {
        return this._modifiers.push({type: type, args: args}), this;
    }


    /**
     * Export the current query to a CSV file, use in place of "exec()";
     *
     * Example:
     * NanoSQL("users").query("select").toCSV(true).then(function(csv, db) {
     *   console.log(csv);
     *   // Returns something like:
     *   id,name,pass,postIDs
     *   1,"scott","1234","[1,2,3,4]"
     *   2,"jeb","5678","[5,6,7,8]"
     * });
     *
     * @param {boolean} [headers]
     * @returns {Promise<string>}
     *
     * @memberOf NanoSQLInstance
     */
    public toCSV(headers?: boolean): Promise<string> {
        let t = this;
        return new Promise((res, rej) => {

            t.exec().then((json: Array<Object>) => {
                let header = t._action.args.length ? (<Array<any>>t._action.args).map((m) => {
                    return t._db._models[t._table].filter((f) => f["key"] === m)[0];
                }) : t._db._models[t._table];

                if (headers) {
                    json.unshift(header.map((h) => {
                        return h["key"];
                    }));
                }

                res(json.map((row: StdObject<any>, i) => {
                    if (headers && i === 0) return row;
                    return header.filter((column) => {
                        return row[column["key"]] ? true : false;
                    }).map((column) => {
                        switch (column["type"]) {
                            case "map":
                            // tslint:disable-next-line
                            case "array": return '"' + JSON.stringify(row[column["key"]]).replace(/"/g, "'") + '"';
                            default: return row[column["key"]];
                        }
                    }).join(",");
                }).join("\n"), t);
            });
        });
    }

    /**
     * Executes the current pending query to the db engine, returns a promise with the rows as objects in an array.
     * The second argument of the promise is always the NanoSQL variable, allowing you to chain commands.
     *
     * Example:
     * NanoSQL("users").query("select").exec().then(function(rows, db) {
     *     console.log(rows) // <= [{id:1,username:"Scott",password:"1234"},{id:2,username:"Jeb",password:"1234"}]
     *     return db.query("upsert",{password:"something more secure"}).where(["id","=",1]).exec();
     * }).then(function(rows, db) {
     *  ...
     * })...
     *
     * @returns {(Promise<Array<Object>>)}
     *
     * @memberOf NanoSQLInstance
     */
    public exec(): Promise<Array<Object|NanoSQLInstance>> {

        let t = this;
        let _t = t._table;
        if (t._db._hasEvents[_t]) {  // Only calcluate events if there are listeners
            t._db._triggerEvents = (() => {
                switch (t._action.type) {
                    case "select": return [t._action.type];
                    case "delete":
                    case "upsert":
                    case "drop": return [t._action.type, "change"];
                    default: return [];
                }
            })();
        }


        return new Promise((res, rej) => {

            if (t._error) {
                rej(t._error);
                throw Error;
            }

            if (!t._db.backend) {
                rej();
                throw Error;
            }

            const _tEvent = (data: Array<Object>, callBack: Function, type: string, changedRows: DBRow[], isError: Boolean) => {

                if (t._db._hasEvents[_t]) { // Only trigger events if there are listeners
                    t._db.triggerEvent({
                        name: "error",
                        actionOrView: t._AV,
                        table: _t,
                        query: [t._action].concat(t._modifiers),
                        time: new Date().getTime(),
                        result: data,
                        changeType: type,
                        changedRows: changedRows
                    }, t._db._triggerEvents);
                }

                callBack(data, t._db);
            };

            let execArgs = {
                table: _t,
                query: [t._action].concat(t._modifiers),
                viewOrAction: t._AV,
                onSuccess: (rows, type, affectedRows) => {
                    if (t._db.doingTransaction) {
                        res(rows, t._db);
                    } else {
                        _tEvent(rows, res, type, affectedRows, false);
                    }
                },
                onFail: (err: any) => {
                    if (t._db.doingTransaction) {
                        res(err, t._db);
                    } else {
                        t._db._triggerEvents = ["error"];
                        if (rej) _tEvent(err, rej, "error", [], true);
                    }
                }
            };

            if (t._db._queryMod) {
                t._db._queryMod(execArgs, (newArgs) => {
                    t._db.backend._exec(newArgs);
                });
            } else {
                t._db.backend._exec(execArgs);
            }
        });
    }

}

/**
 * This object is passed into a the database connect function to activate it.
 *
 * @export
 * @interface DBConnect
 */
export interface DBConnect {
    _models: StdObject<Array<DataModel>>;
    _actions: StdObject<Array<ActionOrView>>;
    _views: StdObject<Array<ActionOrView>>;
    _functions: {
        [key: string]:  DBFunction
    };
    _config: Array<any>;
    _parent: NanoSQLInstance;
    _onSuccess: Function;
    _onFail?: Function;
}

/**
 * These variables are passed into the database execution function.
 *
 * @export
 * @interface DBExec
 */
export interface DBExec {
    table: string;
    query: Array<QueryLine>;
    viewOrAction: string;
    onSuccess: (rows: Array<Object>, type: string, affectedRows: DBRow[]) => void;
    onFail: (rows: Array<Object>) => void;
}

export interface NanoSQLBackend {

    /**
     * Inilitize the database for use, async so you can connect to remote stuff as needed.
     *
     * This is called by NanoSQL once to the DB driver once the developer calls "connect()".
     *
     * Models, Views, Actions, and added Filters are all sent in at once.  Once the "onSuccess" function is called the database should be ready to use.
     *
     * The "preCustom" var contains an array of calls made to the "custom" method before connect() was called.  All subsequent custom() calls will pass directly to the database "custom()" method.
     *
     * @param {DBConnect} connectArgs
     *
     * @memberOf NanoSQLBackend
     */
    _connect(connectArgs: DBConnect): void;

    /**
     * Executes a specific query on the database with a specific table
     *
     * This is called on "exec()" and all the query parameters are passed in as an array of Objects containing the query parameters.
     *
     * The syntax is pretty straightforward, for example a query like this: NanoSQL("users").query("select").exec() will turn into this:
     * ```ts
     * [{type:'select',args:undefined}]
     * ```
     *
     * Let's say the person using the system gets crazy and does NanoSQL("users").query("select",['username']).orderBy({name:'desc'}).exec();
     * Then you get this:
     * ```ts
     * [{type:'select',args:['username']},{type:"orderBy",args:{name:'desc}}]
     * ```
     *
     * With that information and the table name you can create the query as needed, then return it through the onSuccess function.
     *
     * @param {DBExec} execArgs
     *
     * @memberOf NanoSQLBackend
     */
    _exec(execArgs: DBExec): void;

    /**
     * Optional extension for the database.
     * The extend method for NanoSQL is just a passthrough to this method.
     * An entirely different and new API can be built around this.
     *
     * @param {NanoSQLInstance} instance
     * @param {...Array<any>} args
     * @returns {*}
     *
     * @memberOf NanoSQLBackend
     */
    _extend?(instance: NanoSQLInstance, ...args: Array<any>): any;

    /**
     * Let the database driver know it needs to start or end a transaction
     *
     * @param {("start"|"end")} type
     *
     * @memberOf NanoSQLBackend
     */
    _transaction?(type: "start"|"end"): void;
}

/**
 * @internal
 */
let _NanoSQLStatic = new NanoSQLInstance();

export const nSQL = (setTablePointer?: string) => {
    return _NanoSQLStatic.table(setTablePointer);
};