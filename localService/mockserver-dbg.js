/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/util/MockServer",
	"rsh/eam/ordergantts1/localService/customMockRequests",
	"rsh/eam/ordergantts1/localService/customMockRequestsForMaintenanceOrder"
], function (MockServer, CustomizedMockRequests, customMockReqMaintOrd) {
	"use strict";
	var oMockServer,
		oMockServerMaintenanceOrder,
		_sAppModulePath = "rsh/eam/ordergantts1/",
		_sJsonFilesModulePath = _sAppModulePath + "localService/mockdata",
		_sJsonFilesModulePathMaintenanceOrder = _sAppModulePath + "localService/mockdataMaintenanceOrder";

	return {

		/**
		 * Initializes the mock server.
		 * You can configure the delay with the URL parameter "serverDelay".
		 * The local mock data in this folder is returned instead of the real data for testing.
		 * @public
		 */
		init: function () {
			var oUriParameters = jQuery.sap.getUriParameters(),
				sJsonFilesUrl = jQuery.sap.getModulePath(_sJsonFilesModulePath),
				sManifestUrl = jQuery.sap.getModulePath(_sAppModulePath + "manifest", ".json"),
				sEntity = "C_RSHOrdersAndOperations",
				sErrorParam = oUriParameters.get("errorType"),
				iErrorCode = sErrorParam === "badRequest" ? 400 : 500,
				oManifest = jQuery.sap.syncGetJSON(sManifestUrl).data,
				oMainDataSource = oManifest["sap.app"].dataSources.RSH_EAM_ORDER_GANTT_SRV,
				sMetadataUrl = jQuery.sap.getModulePath(_sAppModulePath + oMainDataSource.settings.localUri.replace(".xml", ""), ".xml"),
				// ensure there is a trailing slash
				sMockServerUrl = /.*\/$/.test(oMainDataSource.uri) ? oMainDataSource.uri : oMainDataSource.uri + "/";

			oMockServer = new MockServer({
				rootUri: sMockServerUrl
			});

			// configure mock server with a delay of 1s
			MockServer.config({
				autoRespond: true,
				autoRespondAfter: (oUriParameters.get("serverDelay") || 1000)
			});

			//Check the uri parameter in order to switch mockdata folder
			if (oUriParameters.get("journey") === "relationshipJourney") {
				_sJsonFilesModulePath = _sAppModulePath + "localService/mockdataRelationship";
				sJsonFilesUrl = jQuery.sap.getModulePath(_sJsonFilesModulePath);
			}

			// load local mock data
			oMockServer.simulate(sMetadataUrl, {
				sMockdataBaseUrl: sJsonFilesUrl,
				bGenerateMissingMockData: true //,
					//aEntitySetsNames: ["C_RSHOrdersAndOperations"]
			});

			// Add custom handlers used for the FunctionImports.
			var aMyRequests = CustomizedMockRequests.getRequests(oMockServer.getRequests(), oMockServer);
			oMockServer.setProperty("requests", aMyRequests);

			var aRequests = aMyRequests,
				fnResponse = function (iErrCode, sMessage, aRequest) {
					aRequest.response = function (oXhr) {
						oXhr.respond(iErrCode, {
							"Content-Type": "text/plain;charset=utf-8"
						}, sMessage);
					};
				};

			// handling the metadata error test
			if (oUriParameters.get("metadataError")) {
				aRequests.forEach(function (aEntry) {
					if (aEntry.path.toString().indexOf("$metadata") > -1) {
						fnResponse(500, "metadata Error", aEntry);
					}
				});
			}

			// Handling request errors
			if (sErrorParam) {
				aRequests.forEach(function (aEntry) {
					if (aEntry.path.toString().indexOf(sEntity) > -1) {
						fnResponse(iErrorCode, sErrorParam, aEntry);
					}
				});
			}
			//To test create relationship journey, we need to start maintenance order service
			if (oUriParameters.get("journey") === "relationshipJourney") {
				var sJsonFilesUrlMaintenanceOrder = jQuery.sap.getModulePath(_sJsonFilesModulePathMaintenanceOrder),
					sMetadataUrlMaintenanceOrder = jQuery.sap.getModulePath(_sAppModulePath + "localService/RSH_SB_MAINTENANCE_ORDER/metadata", ".xml"),
					sMockServerUrlMaintenanceOrder = "/sap/opu/odata/sap/RSH_SB_MAINTENANCE_ORDER/";
				oMockServerMaintenanceOrder = new MockServer({
					rootUri: sMockServerUrlMaintenanceOrder
				});

				oMockServerMaintenanceOrder.simulate(sMetadataUrlMaintenanceOrder, {
					sMockdataBaseUrl: sJsonFilesUrlMaintenanceOrder,
					bGenerateMissingMockData: true
				});

				var aMyMaintOrdRequests = customMockReqMaintOrd.getRequests(oMockServerMaintenanceOrder.getRequests(), oMockServerMaintenanceOrder);
				oMockServerMaintenanceOrder.setProperty("requests", aMyMaintOrdRequests);
				oMockServerMaintenanceOrder.start();

			}

			oMockServer.start();

			jQuery.sap.log.info("Running the app with mock data");
		},

		/**
		 * @public returns the mockserver of the app, should be used in integration tests
		 * @returns {sap.ui.core.util.MockServer} the mockserver instance
		 */
		getMockServer: function () {
			return oMockServer;
		}
	};

});