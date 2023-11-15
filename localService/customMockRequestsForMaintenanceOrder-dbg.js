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
			 * MockServer 
			 * @public
			 * @returns {Object} MockServer Handler 
			 * */
			connectTwoOperations: function () {
				return {
					method: "POST",
					path: new RegExp("(C_RSHMaintenanceOrdOperationTP)(\\(([^/\\?#]+)\\)/?(.*)?)?"),
					response: function (oXhr, sUrlParams) {
						var oRequest = new XMLHttpRequest();

						oRequest.onload = (function (oResponse) {
							var oMessageContent = {};
							oMessageContent = oResponse.target.responseHeaders["sap-message"];
							var oHeader = {
								"sap-message": oMessageContent
							};
							oXhr.respondJSON(oResponse.target.status, oHeader, oResponse.target.responseText);
							return true;
						});
						//Communicate the change to Gantt service
						oRequest.open("POST", "/sap/opu/odata/sap/RSH_EAM_ORDER_GANTT_SRV/" + "C_RSHOperationRelationships", false);
						oRequest.send(oXhr.requestBody);
						return true;
					}
				};
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
				this.addRequest(aRequests, this.connectTwoOperations(), thisArg);
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