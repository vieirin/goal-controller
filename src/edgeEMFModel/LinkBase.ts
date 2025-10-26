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
import {InternalEObject} from "ecore/InternalEObject";
import {BasicEObjectImpl} from "ecore/BasicEObjectImpl";
		
			export class LinkBase
			extends BasicEObjectImpl
			implements Link
			{
				private _outgoing:OrderedSet<Goal> = null;
				
				get outgoing():OrderedSet<Goal>{
					if(this._outgoing===null){
						this._outgoing = new OrderedSet<Goal>(this, EdgemodelPackageLiterals.LINK__OUTGOING, EdgemodelPackageLiterals.GOAL__PARENT);
							
					}
					return this._outgoing;
					
				}
				
				
				private _incoming:Node = null;
				get incoming():Node{
				
					return this._incoming;
				}
				set incoming(value:Node) {
					if (value != this.incoming) {
						let msgs:NotificationChain = null;
						if (this.incoming != null){
							msgs = (this.incoming).eInverseRemove(this, EdgemodelPackageLiterals.NODE__CHILD, /*Link*/ null , msgs);
						}
						if (value != null){
							msgs = value.eInverseAdd(this, EdgemodelPackageLiterals.NODE__CHILD, /*Link*/ null, msgs);
						}
						msgs = this.basicSetIncoming(value, msgs);
						if (msgs != null) {
							msgs.dispatch();
						}
					}
					else if (this.eNotificationRequired()){
						this.eNotify(new ENotificationImpl(this, NotificationImpl.SET,EdgemodelPackageLiterals.LINK__INCOMING , value, value));
					}
				}

			
				public static eStaticClass:EClass;
				
				protected eStaticClass():EClass{
					
					return LinkBase.eStaticClass;
				}
			
				public eInverseAdd(otherEnd:InternalEObject, featureID:number, msgs:NotificationChain): NotificationChain{
					switch (featureID) {
						case EdgemodelPackageLiterals.LINK__OUTGOING:
							return this.outgoing.basicAdd(otherEnd as Goal, msgs);
						case EdgemodelPackageLiterals.LINK__INCOMING:
							if (this.incoming != null){
								msgs = this.incoming.eInverseRemove(this, EdgemodelPackageLiterals.LINK__INCOMING, /*Node*/ null, msgs);
							}
							return this.basicSetIncoming(otherEnd as Node, msgs);
					}
					return super.eInverseAdd(otherEnd, featureID, msgs);
				}
				
				public eInverseRemove(otherEnd:InternalEObject, featureID:number, msgs:NotificationChain):NotificationChain{
					switch (featureID) {
						case EdgemodelPackageLiterals.LINK__OUTGOING:
							return this.outgoing.basicRemove(otherEnd as Goal, msgs);
						case EdgemodelPackageLiterals.LINK__INCOMING:
							return this.basicSetIncoming(null, msgs);
					}
					return super.eInverseRemove(otherEnd, featureID, msgs);
				}
				
			
				public basicSetIncoming(newobj:Node, msgs:NotificationChain):NotificationChain {
					const oldobj = this._incoming;
					this._incoming = newobj;
					if (this.eNotificationRequired()) {
						let notification = new ENotificationImpl(this, NotificationImpl.SET, EdgemodelPackageLiterals.LINK__INCOMING, oldobj, newobj);
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
						case EdgemodelPackageLiterals.LINK__OUTGOING:
							return this.outgoing;
						case EdgemodelPackageLiterals.LINK__INCOMING:
							return this.incoming;
					}
					//return this.eGetFromBasicEObjectImpl(featureID, resolve, coreType);
					return super.eGet(featureID, resolve, coreType);
				}
				
				public eSet_number_any(featureID:number, newValue:any):void {
					switch (featureID) {
						case EdgemodelPackageLiterals.LINK__OUTGOING:
							this.outgoing.clear();
							this.outgoing.addAll(newValue);
							return;
						case EdgemodelPackageLiterals.LINK__INCOMING:
							this.incoming = <Node> newValue;
							return;
					}
					super.eSet_number_any(featureID, newValue);
				}

				
			}
			
