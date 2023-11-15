/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["jquery.sap.global"],
	function (jQuery) {
		"use strict";

		var mockRequests = {

			_aRequestedKeys: null,
			_sEntryFound: null,
			_aKeys: null,
			_oEntitySet: null,

			/**
			 * MockServer handler for the I_MaintOrderOperationTPSetdispatch FunctionImport
			 * @public
			 * @returns {Object} MockServer Handler 
			 * */
			convertDueToDispatch: function () {
				return {
					method: "POST",
					path: new RegExp("I_MaintOrderOperationTPSetdispatch(\\?(.*))?"),
					response: function (oXhr, sUrlParams) {
						var that = this;

						//First fetch all existing entries for the C_RSHOrdersAndOperations entity
						var oResponse = mockRequests._getAllMockEntriesforEntitySet.call(that, "C_RSHOrdersAndOperations");

						if (!oResponse.success || !oResponse.data.d.results[1]) {
							// respond negative - no entity found
							oXhr.respond(404);
						}
						var str = decodeURIComponent(sUrlParams);
						str = str.substring(1);
						var data = {};

						var keyValArray = str.split("&");
						keyValArray.forEach(function (row) {
							var rowArr = row.split("=");
							data[rowArr[0]] = rowArr[1];
						});
						var maintenanceOrder = data.MaintenanceOrder.replace("'", "");
						maintenanceOrder = maintenanceOrder.slice(0, -1);
						var maintenanceOrderOperation = data.MaintenanceOrderOperation.replace("'", "");
						maintenanceOrderOperation = maintenanceOrderOperation.slice(0, -1);
						var oEntry;
						if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0011") {
							oEntry = oResponse.data.d.results[1];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0020") {
							oEntry = oResponse.data.d.results[2];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0050") {
							oEntry = oResponse.data.d.results[5];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0060") {
							oEntry = oResponse.data.d.results[6];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0070") {
							oEntry = oResponse.data.d.results[7];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0080") {
							oEntry = oResponse.data.d.results[8];
						} else {
							oXhr.respond(404);
						}
						//take its key
						var sKeys = "ID='" + oEntry.ID + "'";
						//fetch the corresponding entry by key from the mock server
						var oMockEntry = mockRequests._getSingleEntity.call(this, "C_RSHOrdersAndOperations", sKeys);
						//change its status
						if (oMockEntry.entry.ProcessingStatus !== 40) {
							oMockEntry.entry.ProcessingStatus = 30;
							oMockEntry.entry.ProcessingStatusText = "Dispatched";
						}

						// Respond with one found and modified entry
						// !!!!!Important!!!
						// Sending the response with modified status is not enough to see the changes in Gantt 
						// It is expected after Function Import batch call one more refresh batch is called to update the Gantt
						// only after second batch the changes will be visible in the Gantt
						//such refresh is triggered by the productive set dispatch code 
						oXhr.respondJSON(200, {}, JSON.stringify({
							d: oMockEntry
						}));
						return true;
					}
				};
			},

			/**
			 * MockServer handler for the I_MaintOrderOperationTPUnsetdispatch FunctionImport
			 * @public
			 * @returns {Object} MockServer Handler 
			 * */
			convertDispatchToDue: function () {
				return {
					method: "POST",
					path: new RegExp("I_MaintOrderOperationTPUnsetdispatch(\\?(.*))?"),
					response: function (oXhr, sUrlParams) {

						var that = this;
						//First fetch all existing entries for the C_RSHOrdersAndOperations entity
						var oResponse = mockRequests._getAllMockEntriesforEntitySet.call(that, "C_RSHOrdersAndOperations", oXhr, sUrlParams);

						if (!oResponse.success || !oResponse.data.d.results[0]) {
							// respond negative - no entity found
							oXhr.respond(404);
						}

						var str = decodeURIComponent(sUrlParams);
						str = str.substring(1);
						var data = {};

						var keyValArray = str.split("&");
						keyValArray.forEach(function (row) {
							var rowArr = row.split("=");
							data[rowArr[0]] = rowArr[1];
						});
						var maintenanceOrder = data.MaintenanceOrder.replace("'", "");
						maintenanceOrder = maintenanceOrder.slice(0, -1);
						var maintenanceOrderOperation = data.MaintenanceOrderOperation.replace("'", "");
						maintenanceOrderOperation = maintenanceOrderOperation.slice(0, -1);
						var oEntry;
						if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0011") {
							oEntry = oResponse.data.d.results[1];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0020") {
							oEntry = oResponse.data.d.results[2];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0060") {
							oEntry = oResponse.data.d.results[6];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0090") {
							oEntry = oResponse.data.d.results[9];
						} else {
							oXhr.respond(404);
						}

						var sKeys = "ID='" + oEntry.ID + "'";
						//fetch the corresponding entry by key from the mock server
						var oMockEntry = mockRequests._getSingleEntity.call(this, "C_RSHOrdersAndOperations", sKeys);
						//change its status
						if (oMockEntry.entry.ProcessingStatus !== 40) {
							oMockEntry.entry.ProcessingStatus = 20;
							oMockEntry.entry.ProcessingStatusText = "Due";
						}

						// Respond with one found and modified entry
						// !!!!!Important!!!
						// Sending the response with modified status is not enough to see the changes in Gantt 
						// It is expected after Function Import batch call one more refresh batch is called to update the Gantt
						// only after second batch the changes will be visible in the Gantt
						//such refresh is triggered by the prductive cancel dispatch code 
						oXhr.respondJSON(200, {}, JSON.stringify({
							d: oMockEntry
						}));
						return true;
					}
				};
			},

			/**
			 * MockServer handler for the I_MaintOrderOperationTPChangeassgmt FunctionImport
			 * @public
			 * @returns {Object} MockServer Handler 
			 * */
			triggerWorkCenterOperationMassChange: function () {
				return {
					method: "POST",
					path: new RegExp("I_MaintOrderOperationTPChangeassgmt(\\?(.*))?"),
					response: function (oXhr, sUrlParams) {

						var that = this;

						var oResponse = mockRequests._getAllMockEntriesforEntitySet.call(that, "C_RSHOrdersAndOperations", oXhr, sUrlParams);

						if (!oResponse.success || !oResponse.data.d.results[1]) {
							// respond negative - no entity found
							oXhr.respond(404);
						}

						//var oEntry = oResponse.data.d.results[1]; 

						var str = decodeURIComponent(sUrlParams);
						str = str.substring(1);
						var data = {};

						var keyValArray = str.split("&");
						keyValArray.forEach(function (row) {
							var rowArr = row.split("=");
							data[rowArr[0]] = rowArr[1];
						});
						var maintenanceOrder = data.MaintenanceOrder.replace("'", "");
						maintenanceOrder = maintenanceOrder.slice(0, -1);
						var maintenanceOrderOperation = data.MaintenanceOrderOperation.replace("'", "");
						maintenanceOrderOperation = maintenanceOrderOperation.slice(0, -1);
						var oEntry;
						if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0011") {
							oEntry = oResponse.data.d.results[1];
						} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0020") {
							oEntry = oResponse.data.d.results[2];
						} else {
							oXhr.respond(404);
						}

						var sKeys = "ID='" + oEntry.ID + "'";
						var oMockEntry = mockRequests._getSingleEntity.call(this, "C_RSHOrdersAndOperations", sKeys);

						//	oMockEntry.entry.WorkCenter = "WorkCenter 2";
						oMockEntry.entry.MainWorkCenter = "WorkCenter 2";

						oXhr.respondJSON(200, {}, JSON.stringify({
							d: oMockEntry
						}));
						return true;
					}
				};
			},

			/**
			 * MockServer handler for I_MaintOrderOperationTPChangescheduling FunctionImport
			 * Handles Rescheduling calls during Remove Constraints and Chenge Date
			 * @public
			 * @returns {Object} MockServer Handler 
			 * */
			triggerChangeScheduling: function () {
				return {
					method: "POST",
					path: new RegExp("I_MaintOrderOperationTPChangescheduling(\\?(.*))?"),
					response: function (oXhr, sUrlParams) {
						var that = this;
						var oHeader = {};
						//First fetch all existing entries for the C_RSHOrdersAndOperations entity
						var oResponse = mockRequests._getAllMockEntriesforEntitySet.call(that, "C_RSHOrdersAndOperations", oXhr, sUrlParams);

						if (!oResponse.success || !oResponse.data.d.results[1]) {
							// respond negative - no entity found
							oXhr.respond(404);
						}
						if (sUrlParams.includes("Schedulingstartconstraint='%20'")) {
							var str = decodeURIComponent(sUrlParams);
							str = str.substring(1);
							var data = {};

							var keyValArray = str.split("&");
							keyValArray.forEach(function (row) {
								var rowArr = row.split("=");
								data[rowArr[0]] = rowArr[1];
							});
							var maintenanceOrder = data.MaintenanceOrder.replace("'", "");
							maintenanceOrder = maintenanceOrder.slice(0, -1);
							var maintenanceOrderOperation = data.MaintenanceOrderOperation.replace("'", "");
							maintenanceOrderOperation = maintenanceOrderOperation.slice(0, -1);
							var oEntry;
							if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0070") {
								oEntry = oResponse.data.d.results[7];
							} else if (maintenanceOrder === "4018843" && maintenanceOrderOperation === "0090") {
								oEntry = oResponse.data.d.results[9];
							} else {
								oXhr.respond(404);
							}
							//take its key
							var sKeys = "ID='" + oEntry.ID + "'";
							//fetch the corresponding entry by key from the mock server
							var oMockEntry = mockRequests._getSingleEntity.call(this, "C_RSHOrdersAndOperations", sKeys);
							//change its status
							if (oMockEntry.entry.OpBscStartDateConstraintType === "1") {
								oMockEntry.entry.OpBscStartDateConstraintType = "";
								oMockEntry.entry.OrderOpStartConstraintDateTime = null;
							}
						} else {
							oEntry = oResponse.data.d.results[1];
							sKeys = "ID='" + oEntry.ID + "'";
							oMockEntry = mockRequests._getSingleEntity.call(this, "C_RSHOrdersAndOperations", sKeys);
							oMockEntry.entry.PlannedStartDate = mockRequests._convertToJSONDate(new Date());
							if (!this.bMessageReturned) {
								var oMessageContent = {
									"code": "RSH_LVLING_CONFLICTS/" + Math.floor(Math.random() * 100) + 1, // Random code :)
									"message": "Test message to check message manager",
									"severity": "success",
									"target": "/#TRANSIENT#",
									"details": []
								};
								oHeader = {
									"sap-message": JSON.stringify(oMessageContent)
								};
								this.bMessageReturned = true;
							}
						}

						oXhr.respondJSON(200, oHeader, JSON.stringify({
							d: oMockEntry
						}));
						return true;
					}
				};
			},

			_convertToJSONDate: function (dt) {
				// var dt = new Date(strDate);
				var newDate = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate(), dt.getHours(), dt.getMinutes(), dt.getSeconds(),
					dt.getMilliseconds()));
				return "/Date(" + newDate.getTime() + ")/";
			},

			/*						getOrderlist: function() {
										return {
											method: "GET",
											path: new RegExp("(C_RSHOrdersAndOperations)/?(\\?(.*))?"),
											//(C_RSHOrdersAndOperations)\/?(\?(.*))?
											//(C_RSHOrdersAndOperations)\(([^\/\?#]+)\)\/?(\?(.*))?
											response: function(oXhr, sEntityName, sKeys, sNavProperty, sUrlParams) {
												var that = this;

												//Replacement for the sjax call due to checkmarx error, gets activeAssignment
												var oResponse = mockRequests._readMockEntry.call(that, sEntityName, oXhr, "?$skip=0");

												if (!oResponse.success || !oResponse.data.d.results[0]) {
													// respond negative - no entity found
													oXhr.respond(404);
												}

												// mockRequests.fnGetEntitySetEntry.call(this, "C_Rshresourcelist", sKeys);//, "guid'" + oDraftEntry.ResourceDemandUUID +
												// "'");
												var oEntry = oResponse.data.d; //.results;
												oXhr.respondJSON(200, {}, JSON.stringify({
													d: oEntry
												}));
												return true;
											}
										};
									},*/

			/**
			 * Returns Mockdata for the given EntitySetName with Query operations aplied
			 * @private
			 * @param {string} sEntitySetName EntitySet Name
			 * @returns {Object} result object
			 * */
			_getAllMockEntriesforEntitySet: function (sEntitySetName) {

				var oResponse = {
					success: false,
					data: {
						d: {
							results: []
						}
					}
				};

				try {
					var aData = this._oMockdata[sEntitySetName];

					var oFilteredData = {
						results: jQuery.extend(true, [], aData)
					};

					oResponse.success = true;
					oResponse.data.d = oFilteredData;
				} catch (e) {
					oResponse.success = false;
				}

				return oResponse;
			},

			/**
			 * Gets a single entity matching the given keys
			 * @private
			 * @param {string} sEntitySetName entitySet name
			 * @param {string} _sKeys entity keys
			 * @returns {Object} entity data matching the given keys
			 * */
			_getSingleEntity: function (sEntitySetName, _sKeys) {

				this._aRequestedKeys = null;
				this._sEntryFound = null;
				this._aKeys = null;
				this._oEntitySet = null;

				var that = this;
				var sKeys = _sKeys;

				sKeys = decodeURIComponent(sKeys);
				this._oEntitySet = that._mEntitySets[sEntitySetName];
				this._aKeys = this._oEntitySet.keys;
				// split keys
				this._aRequestedKeys = sKeys.split(",");

				// check number of keys to be equal to the entity keys and validates keys type for quotations
				if (this._aRequestedKeys.length !== this._aKeys.length) {
					that._logAndThrowMockServerCustomError(400, that._oErrorMessages.INVALID_KEY_PREDICATE_QUANTITY);
				}
				that._isRequestedKeysValid(this._oEntitySet, this._aRequestedKeys);
				if (this._aRequestedKeys.length === 1 && !this._aRequestedKeys[0].split("=")[1]) {
					this._aRequestedKeys = [this._aKeys[0] + "=" + this._aRequestedKeys[0]];
				}
				return mockRequests._getEntitySetByKeys(that._oMockdata[sEntitySetName], this._aRequestedKeys, this._aKeys, this._oEntitySet,
					that._trim,
					that);
			},

			_getEntitySetByKeys: function (aMockDataAll, aRequestedKeys, aKeys, oEntitySet, fTream) {
				var that = this;
				// check each key for existence and value
				for (var j = 0; j < aMockDataAll.length; j++) {
					for (var i = 0; i < aRequestedKeys.length; i++) {
						var aKeyVal = aRequestedKeys[i].split("=");
						var sKey = fTream(aKeyVal[0]);
						//key doesn't match, continue to next entry
						if (jQuery.inArray(sKey, aKeys) === -1) {
							return true; // = continue
						}

						var sNewValue = fTream(aKeyVal[1]);
						var sOrigiValue = aMockDataAll[j][sKey];

						switch (oEntitySet.keysType[sKey]) {
						case "Edm.String":
							sNewValue = sNewValue.replace(/^\'|\'$/g, "");
							break;
						case "Edm.DateTime":
							sOrigiValue = that._getDateTime(sOrigiValue);
							break;
						case "Edm.SByte":
							if (!that._isValidNumber(sNewValue)) {
								return false; // = break
							}
							sNewValue = parseFloat(sNewValue);
							break;
						case "Edm.Guid":
							sNewValue = sNewValue.replace(/^guid\'|\'$/g, "");
							break;
						case "Edm.Boolean":
							if (["true", "false"].indexOf(sNewValue) === -1) {
								that._logAndThrowMockServerCustomError(400, that._oErrorMessages.INVALID_KEY_TYPE, sKey);
							}
							sNewValue = sNewValue === "true";
							break;
						default:
							sNewValue = sNewValue;
						}
						//compare the current entity resord value with the requested value
						if (sOrigiValue === sNewValue) {
							//if entry found stop looping
							this._sEntryFound = true;
							break; // = continue
						} else {
							//if not found, continue looping
							this._sEntryFound = false;
						}
					}
					//if entry found stop looping
					if (this._sEntryFound === true) {
						break;
					}
				}
				if (this._sEntryFound) {
					this._oFoundEntry = {
						index: j,
						entry: aMockDataAll[j]
					};
					return this._oFoundEntry; // = break
				} else {
					return false;
				}
			},

			createRelationships: function () {
				return {
					method: "POST",
					path: new RegExp("(C_RSHOperationRelationships)(\\(([^/\\?#]+)\\)/?(.*)?)?"),
					response: function (oXhr, sEntityName) {
						var that = this;
						var oRequestBody = JSON.parse(oXhr.requestBody);
						var oResponse = mockRequests._createNewRelationshipEntry(oRequestBody, sEntityName, that);
						oXhr.respondJSON(oResponse.iResult, oResponse.oRespondHeader, oResponse.sResponseText);
						return true;
					}
				};
			},

			_createNewRelationshipEntry: function (oRequestBody, sEntityName, oContext) {
				var oRelationshipEntity = {};
				var __metadata = {};

				oRelationshipEntity.__metadata = {};

				__metadata.id = "C_RSHOperationRelationships(PredecessorOrder='" + oRequestBody.MaintenanceOrder + "',PredecessorOrderOperation='" +
					oRequestBody.MaintenanceOrderOperation + "',SuccessorOrder='" + oRequestBody.RelatedMaintenanceOrder +
					"',SuccessorOrderOperation='" +
					oRequestBody.RelatedMaintOrderOperation +
					"')";
				__metadata.uri = __metadata.id;
				__metadata.type = "RSH_EAM_ORDER_GANTT_SRV.C_RSHOperationRelationshipsType";
				oRelationshipEntity.__metadata = __metadata;
				oRelationshipEntity.NetworkActivityRelationType = mockRequests._getExternalRelationshipType(oRequestBody.OrderOpRelationshipIntType);

				var bDoesRelationshipExist = mockRequests._isRelationshipPresent(oContext._oMockdata[sEntityName], oRelationshipEntity.__metadata.id,
					oRelationshipEntity.NetworkActivityRelationType);

				var oResponse = {};
				oResponse.oRespondHeader = {};
				oResponse.sResponseText = {};

				var oMessageContent = {};

				if (bDoesRelationshipExist) {

					oResponse.iResult = 400;

					oMessageContent = {
						"error": {
							"code": "CN/824",
							"message": "Relationship from " + oRequestBody.MaintenanceOrder + " " + oRequestBody.MaintenanceOrderOperation +
								" to " + oRequestBody.RelatedMaintenanceOrder + " " + oRequestBody.RelatedMaintOrderOperation + " already exists",
							"target": "",
							"severity": "error",
							"transition": true,
							"details": []
						}
					};
					oResponse.oRespondHeader = {
						"Content-Type": "application/json;charset=utf-8"
					};

					oResponse.sResponseText = JSON.stringify(oMessageContent);
					return oResponse;
				}

				oMessageContent = {
					"code": "IW/080",
					"message": "Order saved with number " + oRequestBody.MaintenanceOrder,
					"target": "",
					"severity": "success",
					"transition": true,
					"details": []
				};
				oResponse.iResult = 201;
				oResponse.oRespondHeader = {
					"Content-Type": "application/json;charset=utf-8",
					"sap-message": JSON.stringify(oMessageContent)
				};
				oRelationshipEntity.PredecessorOrder = oRequestBody.MaintenanceOrder;
				oRelationshipEntity.PredecessorOrderOperation = oRequestBody.MaintenanceOrderOperation;
				oRelationshipEntity.SuccessorOrder = oRequestBody.RelatedMaintenanceOrder;
				oRelationshipEntity.SuccessorOrderOperation = oRequestBody.RelatedMaintOrderOperation;
				oRelationshipEntity.RelationshipIsExplicit = "X";
				oRelationshipEntity.PredecessorOrderOperationRowID = "00000" + oRequestBody.MaintenanceOrder + oRequestBody.MaintenanceOrderOperation;
				oRelationshipEntity.SuccessorOrderOperationRowID = "00000" + oRequestBody.RelatedMaintenanceOrder + oRequestBody.RelatedMaintOrderOperation;
				oContext._oMockdata[sEntityName] = oContext._oMockdata[sEntityName].concat(oRelationshipEntity);

				oResponse.sResponseText = JSON.stringify({
					d: oRelationshipEntity
				});

				return oResponse;
			},

			_isRelationshipPresent: function (aMockdata, sMetadataId, sRelationshipType) {
				for (var i = 0; i < aMockdata.length; i++) {
					if (aMockdata[i].__metadata.id.indexOf(sMetadataId) !== -1 && aMockdata[i].NetworkActivityRelationType === sRelationshipType) {
						return true;
					}
				}
				return false;
			},

			_getExternalRelationshipType: function (sRelationshipType) {
				switch (sRelationshipType) {
				case "NF":
					return "FinishToStart";
				case "AF":
					return "StartToStart";
				case "EF":
					return "FinishToFinish";
				case "SF":
					return "StartToFinish";
				default:
					return " ";
				}
			},

			/**
			 * Returns an updated array of handlers for the mockserver, containing the default auto generated handlers 
			 * and addicional custom developed handlers.
			 * @param {array} aRequests auto generated handlers of the mockserver
			 * @param {object} thisArg mockserver instance object
			 * @returns {array} array of handlers
			 * @public
			 * */
			getRequests: function (aRequests, thisArg) {

				//this.addRequest(aRequests, this.getOrderlist(), thisArg);
				this.addRequest(aRequests, this.convertDueToDispatch(), thisArg);
				this.addRequest(aRequests, this.convertDispatchToDue(), thisArg);
				// I_MaintOrderOperationTPChangeassgmt
				this.addRequest(aRequests, this.triggerWorkCenterOperationMassChange(), thisArg);
				// I_MaintOrderOperationTPChangescheduling
				this.addRequest(aRequests, this.triggerChangeScheduling(), thisArg);

				this.addRequest(aRequests, this.createRelationships(), thisArg);
				return aRequests;
			},

			addRequest: function (aRequests, customRequest, thisArg) {
				var oRequest = aRequests.find(function (oItem) {
					return oItem.path.toString() === customRequest.path.toString();
				});

				if (oRequest) { //override existing request
					oRequest.response = customRequest.response.bind(thisArg);
				} else { //add new request
					oRequest = customRequest;
					oRequest.response = customRequest.response.bind(thisArg);
					aRequests.push(oRequest);
				}
			}
		};
		return mockRequests;
	},
	true);