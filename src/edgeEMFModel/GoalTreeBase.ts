import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {Goal} from "edgemodel/Goal";
import {Task} from "edgemodel/Task";
import {GoalTree} from "edgemodel/GoalTree";
import {Resource} from "edgemodel/Resource";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {Bag} from "ecore/Bag";
import {Sequence} from "ecore/Sequence";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class GoalTreeBase
			extends BasicEObjectImpl
			implements GoalTree
			{
				private _root:Goal = null;
				get root():Goal{
				
					return this._root;
				}
				set root(value:Goal) {
					let oldvalue = this._root;
					this._root = value;
					if (this.eNotificationRequired()){
						this.eNotify(new ENotificationImpl(this, NotificationImpl.SET,EdgemodelPackageLiterals.GOAL_TREE__ROOT , oldvalue, value));
					}
				}
				
				get allTasks():Bag<Task>{
					//TODO implement derivation
					return null;
					
				}
				
				
				
				get allGoals():Sequence<Goal>{
					//TODO implement derivation
					return null;
					
				}
				
				
				
				get allResource():Bag<Resource>{
					//TODO implement derivation
					return null;
					
				}
				
				

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return GoalTreeBase.eStaticClass;
				}
			
			
				public basicSetRoot(newobj:Goal, msgs:NotificationChain):NotificationChain {
					const oldobj = this._root;
					this._root = newobj;
					if (this.eNotificationRequired()) {
						let notification = new ENotificationImpl(this, NotificationImpl.SET, EdgemodelPackageLiterals.GOAL_TREE__ROOT, oldobj, newobj);
						if (msgs == null){
							msgs = notification;
						}
						else{
							msgs.add(notification);
						}
					}
					return msgs;
				}
				
			
				public eGet_number_boolean_boolean(featureID:number, resolve:boolean, coreType:boolean):any{
					switch (featureID) {
						case EdgemodelPackageLiterals.GOAL_TREE__ROOT:
							return this.root;
						case EdgemodelPackageLiterals.GOAL_TREE__ALL_TASKS:
							return this.allTasks;
						case EdgemodelPackageLiterals.GOAL_TREE__ALL_GOALS:
							return this.allGoals;
						case EdgemodelPackageLiterals.GOAL_TREE__ALL_RESOURCE:
							return this.allResource;
					}
					//return this.eGetFromBasicEObjectImpl(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.GOAL_TREE__ROOT:
							this.root = <Goal> newValue;
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
