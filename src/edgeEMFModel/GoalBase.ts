import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {Condition} from "edgemodel/Condition";
import {Goal} from "edgemodel/Goal";
import {NodeImpl} from "edgemodel/NodeImpl";
import {GoalType} from "edgemodel/GoalType";
import {ExecutionDetails} from "edgemodel/ExecutionDetails";
import {Link} from "edgemodel/Link";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {Set} from "ecore/Set";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class GoalBase
			extends NodeImpl
			implements Goal
			{
				private _type:GoalType = GoalType.ACHIEVE;
				get type():GoalType{
					return this._type;
				}
				set type(value:GoalType){
					this._type = value; 
				}
				private _utility:number = 0.0;
				get utility():number{
					return this._utility;
				}
				set utility(value:number){
					this._utility = value; 
				}
				private _cost:number = 0.0;
				get cost():number{
					return this._cost;
				}
				set cost(value:number){
					this._cost = value; 
				}
				get parent():Link{
				
					if (this.eContainerFeatureID() != EdgemodelPackageLiterals.GOAL__PARENT) return null;
					return this.eInternalContainer() as Link;
				}
				set parent(value:Link) {
					if (value != this.eInternalContainer() as Link) {
						let msgs:NotificationChain = null;
						if (this.eInternalContainer() as Link != null){
							msgs = (this.eInternalContainer() as Link).eInverseRemove(this, EdgemodelPackageLiterals.LINK__OUTGOING, /*Goal*/ null , msgs);
						}
						if (value != null){
							msgs = value.eInverseAdd(this, EdgemodelPackageLiterals.LINK__OUTGOING, /*Goal*/ null, msgs);
						}
						msgs = this.basicSetParent(value, msgs);
						if (msgs != null) {
							msgs.dispatch();
						}
					}
					else if (this.eNotificationRequired()){
						this.eNotify(new ENotificationImpl(this, NotificationImpl.SET,EdgemodelPackageLiterals.GOAL__PARENT , value, value));
					}
				}
				private _context:Condition = null;
				get context():Condition{
				
					return this._context;
				}
				set context(value:Condition) {
					if (value != this.context) {
						let msgs:NotificationChain = null;
						if (this.context != null){
							msgs = (this.context).eInverseRemove(this, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.GOAL__CONTEXT, /*null*/ null , msgs);
						}
						if (value != null){
							msgs = value.eInverseAdd(this, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.GOAL__CONTEXT, /*null*/ null, msgs);
						}
						msgs = this.basicSetContext(value, msgs);
						if (msgs != null) {
							msgs.dispatch();
						}
					}
					else if (this.eNotificationRequired()){
						this.eNotify(new ENotificationImpl(this, NotificationImpl.SET,EdgemodelPackageLiterals.GOAL__CONTEXT , value, value));
					}
				}
				private _maintainCondition:Condition = null;
				get maintainCondition():Condition{
				
					return this._maintainCondition;
				}
				set maintainCondition(value:Condition) {
					if (value != this.maintainCondition) {
						let msgs:NotificationChain = null;
						if (this.maintainCondition != null){
							msgs = (this.maintainCondition).eInverseRemove(this, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.GOAL__MAINTAIN_CONDITION, /*null*/ null , msgs);
						}
						if (value != null){
							msgs = value.eInverseAdd(this, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.GOAL__MAINTAIN_CONDITION, /*null*/ null, msgs);
						}
						msgs = this.basicSetMaintainCondition(value, msgs);
						if (msgs != null) {
							msgs.dispatch();
						}
					}
					else if (this.eNotificationRequired()){
						this.eNotify(new ENotificationImpl(this, NotificationImpl.SET,EdgemodelPackageLiterals.GOAL__MAINTAIN_CONDITION , value, value));
					}
				}
				private _exec:ExecutionDetails = null;
				get exec():ExecutionDetails{
				
					return this._exec;
				}
				set exec(value:ExecutionDetails) {
					if (value != this.exec) {
						let msgs:NotificationChain = null;
						if (this.exec != null){
							msgs = (this.exec).eInverseRemove(this, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.GOAL__EXEC, /*null*/ null , msgs);
						}
						if (value != null){
							msgs = value.eInverseAdd(this, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.GOAL__EXEC, /*null*/ null, msgs);
						}
						msgs = this.basicSetExec(value, msgs);
						if (msgs != null) {
							msgs.dispatch();
						}
					}
					else if (this.eNotificationRequired()){
						this.eNotify(new ENotificationImpl(this, NotificationImpl.SET,EdgemodelPackageLiterals.GOAL__EXEC , value, value));
					}
				}

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return GoalBase.eStaticClass;
				}
			
				public eInverseAdd(otherEnd:InternalEObject, featureID:number, msgs:NotificationChain): NotificationChain{
					switch (featureID) {
						case EdgemodelPackageLiterals.GOAL__PARENT:
							if (this.eInternalContainer() != null) {
								msgs = this.eBasicRemoveFromContainer(msgs);
							}
							return this.basicSetParent(otherEnd as Link, msgs);
					}
					return super.eInverseAdd(otherEnd, featureID, msgs);
				}
				
				public eInverseRemove(otherEnd:InternalEObject, featureID:number, msgs:NotificationChain):NotificationChain{
					switch (featureID) {
						case EdgemodelPackageLiterals.GOAL__PARENT:
							return this.basicSetParent(null, msgs);
					}
					return super.eInverseRemove(otherEnd, featureID, msgs);
				}
				
			
				public basicSetParent(newobj:Link, msgs:NotificationChain):NotificationChain {
						msgs = this.eBasicSetContainer(newobj, EdgemodelPackageLiterals.GOAL__PARENT, msgs);
						return msgs;
				}
				public basicSetExec(newobj:ExecutionDetails, msgs:NotificationChain):NotificationChain {
					const oldobj = this._exec;
					this._exec = newobj;
					if (this.eNotificationRequired()) {
						let notification = new ENotificationImpl(this, NotificationImpl.SET, EdgemodelPackageLiterals.GOAL__EXEC, oldobj, newobj);
						if (msgs == null){
							msgs = notification;
						}
						else{
							msgs.add(notification);
						}
					}
					return msgs;
				}
				public basicSetMaintainCondition(newobj:Condition, msgs:NotificationChain):NotificationChain {
					const oldobj = this._maintainCondition;
					this._maintainCondition = newobj;
					if (this.eNotificationRequired()) {
						let notification = new ENotificationImpl(this, NotificationImpl.SET, EdgemodelPackageLiterals.GOAL__MAINTAIN_CONDITION, oldobj, newobj);
						if (msgs == null){
							msgs = notification;
						}
						else{
							msgs.add(notification);
						}
					}
					return msgs;
				}
				public basicSetContext(newobj:Condition, msgs:NotificationChain):NotificationChain {
					const oldobj = this._context;
					this._context = newobj;
					if (this.eNotificationRequired()) {
						let notification = new ENotificationImpl(this, NotificationImpl.SET, EdgemodelPackageLiterals.GOAL__CONTEXT, oldobj, newobj);
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
						case EdgemodelPackageLiterals.GOAL__ID:
							return this.id;
						case EdgemodelPackageLiterals.GOAL__NAME:
							return this.name;
						case EdgemodelPackageLiterals.GOAL__CHILD:
							return this.child;
						case EdgemodelPackageLiterals.GOAL__DEPENDS_ON:
							return this.dependsOn;
						case EdgemodelPackageLiterals.GOAL__MAX_RETRIES:
							return this.maxRetries;
						case EdgemodelPackageLiterals.GOAL__TYPE:
							return this.type;
						case EdgemodelPackageLiterals.GOAL__PARENT:
							return this.parent;
						case EdgemodelPackageLiterals.GOAL__CONTEXT:
							return this.context;
						case EdgemodelPackageLiterals.GOAL__MAINTAIN_CONDITION:
							return this.maintainCondition;
						case EdgemodelPackageLiterals.GOAL__EXEC:
							return this.exec;
						case EdgemodelPackageLiterals.GOAL__UTILITY:
							return this.utility;
						case EdgemodelPackageLiterals.GOAL__COST:
							return this.cost;
					}
					//return this.eGetFromNode(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.GOAL__TYPE:
							this.type = <GoalType> newValue;
							return;
						case EdgemodelPackageLiterals.GOAL__UTILITY:
							this.utility = <number> newValue;
							return;
						case EdgemodelPackageLiterals.GOAL__COST:
							this.cost = <number> newValue;
							return;
						case EdgemodelPackageLiterals.GOAL__PARENT:
							this.parent = <Link> newValue;
							return;
						case EdgemodelPackageLiterals.GOAL__CONTEXT:
							this.context = <Condition> newValue;
							return;
						case EdgemodelPackageLiterals.GOAL__MAINTAIN_CONDITION:
							this.maintainCondition = <Condition> newValue;
							return;
						case EdgemodelPackageLiterals.GOAL__EXEC:
							this.exec = <ExecutionDetails> newValue;
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
