import {EdgemodelPackageLiterals} from "edgemodel/EdgemodelPackageLiterals";
import {Goal} from "edgemodel/Goal";
import {Node} from "edgemodel/Node";
import {Link} from "edgemodel/Link";
import {OrderedSet} from "ecore/OrderedSet";
import {EClass} from "ecore/EClass";
import {NotificationChain} from "ecore/NotificationChain";
import {ENotificationImpl} from "ecore/ENotificationImpl";
import {NotificationImpl} from "ecore/NotificationImpl";
import {AbstractCollection} from "ecore/AbstractCollection";
import {Bag} from "ecore/Bag";
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class NodeBase
			extends BasicEObjectImpl
			implements Node
			{
				private _id:string = '';
				get id():string{
					return this._id;
				}
				private _name:string = '';
				get name():string{
					return this._name;
				}
				private _maxRetries:number = 0;
				get maxRetries():number{
					return this._maxRetries;
				}
				private _child:Link = null;
				get child():Link{
				
					return this._child;
				}
				set child(value:Link) {
					if (value != this.child) {
						let msgs:NotificationChain = null;
						if (this.child != null){
							msgs = (this.child).eInverseRemove(this, EdgemodelPackageLiterals.LINK__INCOMING, /*Node*/ null , msgs);
						}
						if (value != null){
							msgs = value.eInverseAdd(this, EdgemodelPackageLiterals.LINK__INCOMING, /*Node*/ null, msgs);
						}
						msgs = this.basicSetChild(value, msgs);
						if (msgs != null) {
							msgs.dispatch();
						}
					}
					else if (this.eNotificationRequired()){
						this.eNotify(new ENotificationImpl(this, NotificationImpl.SET,EdgemodelPackageLiterals.NODE__CHILD , value, value));
					}
				}
				private _dependsOn:OrderedSet<Goal> = null;
				
				get dependsOn():OrderedSet<Goal>{
					if(this._dependsOn===null){
						this._dependsOn = new OrderedSet<Goal>(this, EdgemodelPackageLiterals.NODE__DEPENDS_ON, BasicEObjectImpl.EOPPOSITE_FEATURE_BASE - EdgemodelPackageLiterals.NODE__DEPENDS_ON);
							
					}
					return this._dependsOn;
					
				}
				
				

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return NodeBase.eStaticClass;
				}
			
				public eInverseAdd(otherEnd:InternalEObject, featureID:number, msgs:NotificationChain): NotificationChain{
					switch (featureID) {
						case EdgemodelPackageLiterals.NODE__CHILD:
							if (this.child != null){
								msgs = this.child.eInverseRemove(this, EdgemodelPackageLiterals.NODE__CHILD, /*Link*/ null, msgs);
							}
							return this.basicSetChild(otherEnd as Link, msgs);
					}
					return super.eInverseAdd(otherEnd, featureID, msgs);
				}
				
				public eInverseRemove(otherEnd:InternalEObject, featureID:number, msgs:NotificationChain):NotificationChain{
					switch (featureID) {
						case EdgemodelPackageLiterals.NODE__CHILD:
							return this.basicSetChild(null, msgs);
					}
					return super.eInverseRemove(otherEnd, featureID, msgs);
				}
				
			
				public basicSetChild(newobj:Link, msgs:NotificationChain):NotificationChain {
					const oldobj = this._child;
					this._child = newobj;
					if (this.eNotificationRequired()) {
						let notification = new ENotificationImpl(this, NotificationImpl.SET, EdgemodelPackageLiterals.NODE__CHILD, oldobj, newobj);
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
						case EdgemodelPackageLiterals.NODE__ID:
							return this.id;
						case EdgemodelPackageLiterals.NODE__NAME:
							return this.name;
						case EdgemodelPackageLiterals.NODE__CHILD:
							return this.child;
						case EdgemodelPackageLiterals.NODE__DEPENDS_ON:
							return this.dependsOn;
						case EdgemodelPackageLiterals.NODE__MAX_RETRIES:
							return this.maxRetries;
					}
					//return this.eGetFromBasicEObjectImpl(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.NODE__CHILD:
							this.child = <Link> newValue;
							return;
						case EdgemodelPackageLiterals.NODE__DEPENDS_ON:
							this.dependsOn.clear();
							this.dependsOn.addAll(newValue);
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
