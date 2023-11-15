/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/rsh/eam/lib/common/controller/BaseController",
	"sap/ui/model/json/JSONModel",
	"sap/rsh/eam/lib/common/formatters/formatter",
	"sap/rsh/eam/lib/common/utils/utils",
	"sap/rsh/eam/lib/common/utils/GanttUtils",
	"sap/rsh/eam/lib/common/controller/OrderPopup",
	"sap/rsh/eam/lib/common/controller/OperationPopup",
	"sap/rsh/eam/lib/common/controller/FunctionalLocationPopup",
	"sap/rsh/eam/lib/common/controller/EquipmentPopup",
	"sap/rsh/eam/lib/common/utils/Constants",
	"sap/rsh/eam/lib/common/utils/StatusCommon",
	"sap/rsh/eam/lib/common/controller/AssignMyWorkCenters",
	"sap/rsh/eam/lib/common/controller/ChangeOperations",
	"sap/gantt/config/SettingItem",
	"sap/rsh/eam/lib/common/utils/AppState",
	"sap/rsh/eam/lib/common/utils/AppPersContainer",
	"sap/rsh/eam/lib/common/utils/ItemHashMap",
	"sap/gantt/def/cal/Calendar",
	"sap/gantt/def/cal/CalendarDefs",
	"sap/gantt/def/cal/TimeInterval",
	"sap/gantt/simple/GanttPrinting",
	"sap/ui/model/Filter",
	"sap/ui/model/FilterOperator",
	"sap/rsh/eam/lib/common/controller/GanttChartSettingsDialog",
	"sap/gantt/simple/Relationship",
	"sap/rsh/eam/lib/common/controller/RelationshipActionSheet",
	"sap/ui/core/Fragment"
], function (BaseController, JSONModel, Formatter, Utils, GanttUtils, OrderPopup, OperationPopup, FunctionalLocationPopup, EquipmentPopup,
	Constants,
	StatusCommon, AssignMyWorkCenters, ChangeOperations, SettingItem, AppState, AppPersContainer, ItemHashMap, Calendar, CalendarDefs,
	TimeInterval, GanttPrinting, Filter, FilterOperator, GanttChartSettingsDialog, Relationship, RelationshipActionSheet, Fragment) {
	"use strict";

	return BaseController.extend("rsh.eam.ordergantts1.controller.SchedulingBoard", {
		formatter: Formatter,
		ganttUtils: GanttUtils,
		DISPATCHED: 30,
		DUE: 20,
		INPROCESS: 40,
		_sOrderAllTechMandatoryFields: "MaintenanceOrder,MaintenanceOrderDesc,MaintenanceOrderInternalID,OrderStartDateTime,OrderEndDateTime,ProcessingStatus,ProcessingStatusText,OrderOperationRowLevel,OrderOperationParentRowID,OrderOperationRowID,OrderOperationIsExpanded,MaintOrderRoutingNumber,LatestAcceptableCompletionDate,OrderType",
		_sOrderAppStateFields: "",
		_sOrderAdditionalPopOverFields: "FunctionalLocationName,FunctionalLocation,EquipmentName,Equipment,MaterialStatusKey,MaterialStatusText",
		_sOperationAllTechMandatoryFields: "MaintenanceOrder,MaintenanceOrderOperation,MaintenanceOrderSubOperation,MaintenanceOrderDesc,MainWorkCenter,MaintenanceOrderInternalID,MaintOrderOperationInternalID,OrderOperationStartDateTime,OrderOperationEndDateTime,ProcessingStatus,ProcessingStatusText,OrderOperationRowLevel,OrderOperationParentRowID,OrderOperationRowID,OrderOperationIsExpanded,WorkCenter,OperationHasLongText,HasError,OperationDescription,WorkCenterInternalID,HasCrossOrderRelationship,HasErrorDescription,ID,PlannedStartDate,PlannedStartTime,OperationPersonResponsible,OperationPersonRespName,MaintOrderRoutingNumber,MaintOrderOperationCounter,OpBscStartDateConstraintType,OrderOpStartConstraintDateTime,OpBscEndDateConstraintType,OrderOpEndConstraintDateTime,OrderType",
		_sOperationAppStateFields: "",
		_afilterFieldGroups:
		// Operation Field Filters
			["MaintenanceNotification", "WorkCenterInternalID", "WorkCenterTypeCode",
			"Plant", "OperationControlKey", "PlannedStartDate", "PlannedEndDate", "PlannedStartTime", "PlannedEndTime",
			"OperationDuration", "OperationPlannedWork", "NumberOfCapacities", "OperationHasLongText", "OperationPersonResponsible",
			"OperationPersonRespName", "HasError", "MaintOpExecutionStageName", "WorkCenter", "PlantSection", "MaintOpExecStageShortText"
		],
		_aExpandFields: ["to_OrderActiveStatus", "to_OrderDetails"],
		_sSelectString: null,
		sSortOrderField: "MaintenanceOrder",
		sSortOperationField: "MaintenanceOrderOperation",
		sOrderSortOrder: "Ascending",
		sOperationSortOrder: null,
		statusCommon: null,
		_bFirstTriggerDone: false,
		_sAfterStatusChangesFinalizedSourceApp: Constants.sAfterStatusChangesFinalizedGanttApp,
		_bPagingRequestOfSubnodes: false,
		_bNewColumnAdded: false,
		_sExistingFilterString: null,
		_sPerformanceFilterOnExpand: null,
		_isIAppState: null,
		sOrderGanttChannel: "rsh.eam.ordergantts",
		sIndiviudalActionOnGanttChange: "individualChangeOnGanttChange",

		onInit: function () {
			this._oOwnerComponent = this.getOwnerComponent();
			this._oOwnerComponent.setModel(new JSONModel({
				"rowCount": 0,
				//by default relationships should be hidden
				"showImpRel": false,
				"showExpRel": false,
				"showNonWorkingTimes": false,
				"showCriticalPath": false,
				"condensedModeActive": false,
				"showFinalDueDate": false
			}), "UIModel");
			this._bAdjustToolbar = false;
			this._oDataModel = this.getOwnerComponent().getModel();
			this._oDataModel.attachBatchRequestSent(this._requestSent, this);
			this._oDataModel.attachBatchRequestCompleted(this._requestComplete, this);
			this._setTimeAxis();
			this.initMessagePopover();
			this.attachModelErrorHandler("readModel");
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var oGanttChartWithTable = this.getView().byId("idOrderGanttChartWithTable");
			//Read app state.
			this._oAppStateData = AppPersContainer.getInstance().getFeatureModel(Constants.sGanttAppState).getData();
			//Required only once for fresh app state
			if (this._oAppStateData.customData === undefined) {
				this._oAppStateData = {};
				this._oAppStateData.customData = GanttUtils.oneTimeInitilzationOfAppState(oTreeTable, oGanttChartWithTable);
			}
			GanttUtils.setGanttColumnPersonalization(this._oAppStateData, oTreeTable, oGanttChartWithTable, this);
			oTreeTable.attachSort(this.onSortRequest, this);
			oTreeTable.attachColumnResize(this._onPersChangeForColumns, this);
			oTreeTable.attachColumnVisibility(this._onPersChangeForColumns, this);
			this.statusCommon = new StatusCommon(this._sAfterStatusChangesFinalizedSourceApp);
			this._setupSettings();
			this.updateRelationshipsAndUtilizations();
			this._setCondensedMode();
			this._bActionInitiatedFromContextMenu = false;
		},

		/** 
		 * Returns the current Time Period set in Filter bar or, 
		 * default Time Period when Filter bar is not yet initialized
		 * @returns {object} with start and end date to be set in filterbar
		 */
		_getCurrentTimePeriod: function () {

			var oInitStartDate;
			var oInitEndDate;

			if (this.getView().byId("idOrderGanttSmartFilterBar").isInitialised() &&
				this.getView().byId("idOrderGanttSmartFilterBar").getFilterData() &&
				(this.getView().byId("idOrderGanttSmartFilterBar").getFilterData().PeriodType.conditionTypeInfo.data.operation === "DATERANGE" ||
					this.getView().byId("idOrderGanttSmartFilterBar").getFilterData().PeriodType.conditionTypeInfo.data.operation === "TODAYFROMTO")) {
				if (Utils.isMockRun()) {
					oInitStartDate = this.getView().byId("idOrderGanttSmartFilterBar").getFilterData().PeriodType.conditionTypeInfo.data.value1;
				} else {
					//added date object copy to prevent contamination of the original date object
					//this will prevent the date to keep increasing whent he go button is pressed again and again
					oInitStartDate = this.dateObjectCopy(this.getView().byId("idOrderGanttSmartFilterBar").getFilterData().PeriodType.ranges[0].value1);
				}
				oInitEndDate = this.dateObjectCopy(this.getView().byId("idOrderGanttSmartFilterBar").getFilterData().PeriodType.ranges[0].value2);
				oInitEndDate.setDate(oInitEndDate.getDate() + 1);
			} else {
				oInitStartDate = new Date();
				oInitEndDate = new Date();
				//To get the correct ending date of one week after selection date, increment needs to be dynamical 
				var iIncrementEndDate = 35 - oInitEndDate.getDay();
				// Set the horizon from -1 week from current date to next 5 weeks 
				oInitStartDate.setDate(oInitStartDate.getDate() - 7);
				oInitEndDate.setDate(oInitEndDate.getDate() + iIncrementEndDate);
			}
			oInitStartDate.setHours(0, 0, 0);
			oInitEndDate.setHours(0, 0, 0);
			this.oPeriodTypeDates = {};

			this.oPeriodTypeDates.oStartDate = Utils.getAdjustedDate(oInitStartDate);
			this.oPeriodTypeDates.oEndDate = Utils.getAdjustedDate(oInitEndDate);

			var returnObj = {};
			returnObj.sCalendarStartDate = oInitStartDate;
			returnObj.sCalendarEndDate = oInitEndDate;
			returnObj.sInitStartDate = this.getDatePerTimeAxisFormat(oInitStartDate);
			returnObj.sInitEndDate = this.getDatePerTimeAxisFormat(oInitEndDate);
			return returnObj;
		},

		/**
		 * Set time axis for the Gantt dynamically with a new strategy each time
		 * (Suggestes best practise from Gantt Team)
		 */
		_setTimeAxis: function () {
			var oCurrenttimePeriod = this._getCurrentTimePeriod();
			var oZoomStrategy = new sap.gantt.axistime.ProportionZoomStrategy({
				totalHorizon: new sap.gantt.config.TimeHorizon({
					startTime: oCurrenttimePeriod.sInitStartDate,
					endTime: oCurrenttimePeriod.sInitEndDate
				}),
				visibleHorizon: new sap.gantt.config.TimeHorizon({
					startTime: oCurrenttimePeriod.sInitStartDate,
					endTime: oCurrenttimePeriod.sInitEndDate
				})
			});
			this.byId("idOrderGanttChartWithTable").setAxisTimeStrategy(oZoomStrategy);
		},

		/**
		 * Formatter method for Order/Operation column in Gantt Tree
		 * @public
		 * @param {int} [orderOperationRowLevel] Row Level showing if order or operation
		 * @param {String} [maintenanceOrder]  Order ID
		 * @param {String} [maintenanceOrderDesc] Order Description
		 * @param {String} [maintenanceOrderOperation] Operation ID
		 * @param {String} [operationDescription] Operation Description
		 * @param {String} [maintenanceOrderSubOperation] Sub Operation ID
		 * @returns {String} Text to be displayed in the Order/Operation column for the specific column
		 */
		formatOrderOpsLink: function (orderOperationRowLevel, maintenanceOrder, maintenanceOrderDesc, maintenanceOrderOperation,
			operationDescription, maintenanceOrderSubOperation) {

			if (orderOperationRowLevel === 0) {
				return maintenanceOrder + " " + maintenanceOrderDesc;
			} else {
				if (maintenanceOrderSubOperation) {
					return maintenanceOrderOperation + " / " + maintenanceOrderSubOperation + " " + operationDescription;
				} else {
					return maintenanceOrderOperation + " " + operationDescription;
				}
			}
		},

		/** Formatter for Concatinating Duration and its Unit
		 * @public
		 * @param {String} [sDuration] Duration
		 * @param {String} [sUnit] Unit
		 * @return {String} Concatenated Duration and its Unit
		 **/
		formatWork: function (sDuration, sUnit) {
			if (sDuration && sUnit) {
				return this.formatter.formatDuration(sDuration) + " " + sUnit;
			} else {
				return "";
			}
		},

		getTitle: function (dStartDateTime, dEndDatetime) {
			if (dStartDateTime !== null && dEndDatetime !== null) {
				return this._formatToLocale(this.removeTimeZoneOffset(dStartDateTime)) + " - " + this._formatToLocale(this.removeTimeZoneOffset(
					dEndDatetime));
			}
			return "";
		},

		removeTimeZoneOffset: function (dTime) {
			if (dTime) {
				return new Date(dTime.getTime() + dTime.getTimezoneOffset() * 60 * 1000);
			} else {
				return undefined;
			}
		},

		/** Formatter to determine the rectangle shape hight
		 * depending on condensed mode is on/off
		 * @public
		 * @param {Integer} [iOrderOperationRowLevel] Order Operation Row Level
		 * @param {Boolean} [bCondensedModeActive] Condensed Mode Active
		 * @return {Integer} Rectangle Hight
		 **/
		getRectangleHight: function (iOrderOperationRowLevel, bCondensedModeActive) {
			if (iOrderOperationRowLevel === 1 && bCondensedModeActive) {
				return 12;
			} else if (iOrderOperationRowLevel === 1 && bCondensedModeActive === false) {
				return 20;
			} else {
				return 0;
			}
		},

		/** Formatter to determine the shevron shape hight
		 * depending on condensed mode is on/off
		 * @public
		 * @param {Integer} [iOrderOperationRowLevel] Order Operation Row Level
		 * @param {Boolean} [bCondensedModeActive] Condensed Mode Active
		 * @return {Integer} Shevron Hight
		 **/
		getShevronHight: function (iOrderOperationRowLevel, bCondensedModeActive) {
			if (iOrderOperationRowLevel === 0 && bCondensedModeActive) {
				return 12;
			} else if (iOrderOperationRowLevel === 0 && bCondensedModeActive === false) {
				return 20;
			} else {
				return 0;
			}
		},

		/** Formatter to determine the shevron shape head width
		 * depending on condensed mode is on/off
		 * @public
		 * @param {Boolean} [bCondensedModeActive] Condensed Mode Active
		 * @return {Integer} Shevron head width
		 **/
		getShevronHeadWidth: function (bCondensedModeActive) {
			if (bCondensedModeActive) {
				return 6;
			} else {
				return 10;
			}
		},

		/** Formatter to determine the shevron shape head width
		 * depending on condensed mode is on/off
		 * @public
		 * @param {Boolean} [bCondensedModeActive] Condensed Mode Active
		 * @return {Integer} Shevron head width
		 **/
		getShevronTailWidth: function (bCondensedModeActive) {
			if (bCondensedModeActive) {
				return 6;
			} else {
				return 10;
			}
		},

		/** Formatter to determine the critical path shape hight
		 * depending on condensed mode is on/off
		 * @public
		 * @param {Integer} [iOrderOperationRowLevel] Order Operation Row Level
		 * @param {Boolean} [bCondensedModeActive] Condensed Mode Active
		 * @return {Integer} Critical Path Hight
		 **/
		getCriticalPathHight: function (iOrderOperationRowLevel, bCondensedModeActive) {
			if (iOrderOperationRowLevel === 1 && bCondensedModeActive) {
				return 1;
			} else if (iOrderOperationRowLevel === 1 && bCondensedModeActive === false) {
				return 2;
			} else {
				return 0;
			}
		},

		/** Formatter to determine the critical path yBias Value
		 * depending on condensed mode is on/off
		 * @public
		 * @param {Integer} [iOrderOperationRowLevel] Order Operation Row Level
		 * @param {Boolean} [bCondensedModeActive] Condensed Mode Active
		 * @return {Integer} Critical Path yBias value
		 **/
		getCPyBiasValue: function (iOrderOperationRowLevel, bCondensedModeActive) {
			if (iOrderOperationRowLevel === 1 && bCondensedModeActive) {
				return 8;
			} else if (iOrderOperationRowLevel === 1 && bCondensedModeActive === false) {
				return 15;
			} else {
				return 0;
			}
		},

		/* Takes constraint-time and constraint-type as input and returns formatted constraint-time if a constraint type exists
		 * @public
		 * @param {Date} [dTime] Constraint start or end time 
		 * @param {String} [sOpConstraintType] Start/End Constraint Type
		 * @returns {Date} If Contraint-type exists
		 */
		constraintTimeFormatter: function (dTime, sOpConstraintType) {
			if (sOpConstraintType === "1") {
				return this.removeTimeZoneOffset(dTime);
			} else {
				return null;
			}
		},

		/* Formatter for Tooltip text of Start Constraint of Operation
		 * @public
		 * @param {String} sStartConstraintType Constraint type for Start Constraint
		 * @param {Date} dOpStartConstraintDateTime Timestamp of Start Constraint
		 * @returns {String} Formatted Tooltip
		 */
		getStartConstraintTypeText: function (sStartConstraintType, dOpStartConstraintDateTime) {

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			if (dOpStartConstraintDateTime) {
				var sOpStartConstraintDate = sap.ui.core.format.DateFormat.getDateInstance().format(dOpStartConstraintDateTime,
					true);
				var sOpStartConstraintTime = sap.ui.core.format.DateFormat.getTimeInstance().format(dOpStartConstraintDateTime,
					true);
			}
			switch (sStartConstraintType) {
			case "1":
				return oResourceBundle.getText("bscStartDateConstraintType1Tooltip", [sOpStartConstraintDate, sOpStartConstraintTime]);
			case "2":
				return oResourceBundle.getText("bscStartDateConstraintType2Tooltip", [sOpStartConstraintDate, sOpStartConstraintTime]);
			case "3":
				return oResourceBundle.getText("bscStartDateConstraintType3Tooltip", [sOpStartConstraintDate, sOpStartConstraintTime]);
			case "4":
				return oResourceBundle.getText("bscStartDateConstraintType4Tooltip");
			default:
				return "";
			}
		},

		/** Formatter for Tooltip text of End Constraint of Operation
		 * @public
		 * @param {String} sEndConstraintType Constraint type for Finish Constraint
		 * @param {Date} dOpEndConstraintDateTime Timestamp of Finish Constraint
		 * @returns {String} Formatted Tooltip
		 */
		getFinishConstraintTypeText: function (sEndConstraintType, dOpEndConstraintDateTime) {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			if (dOpEndConstraintDateTime) {
				var sOpEndConstraintDate = sap.ui.core.format.DateFormat.getDateTimeInstance().format(dOpEndConstraintDateTime, true);
				var sOpEndConstraintTime = sap.ui.core.format.DateFormat.getTimeInstance().format(dOpEndConstraintDateTime,
					true);
			}
			switch (sEndConstraintType) {
			case "1":
				return oResourceBundle.getText("bscEndDateConstraintType1Tooltip", [sOpEndConstraintDate, sOpEndConstraintTime]);
			case "2":
				return oResourceBundle.getText("bscEndDateConstraintType2Tooltip", [sOpEndConstraintDate, sOpEndConstraintTime]);
			case "3":
				return oResourceBundle.getText("bscEndDateConstraintType3Tooltip", [sOpEndConstraintDate, sOpEndConstraintTime]);
			case "4":
				return oResourceBundle.getText("bscEndDateConstraintType4Tooltip");
			default:
				return "";
			}
		},

		/* Formatter for constant for 'fill' of Constraint shape, Used for Both Start Constraint and End Constraint
		 * @public
		 * @param {String} sConstraintType Constraint type for Start Constraint
		 * @param {Date} dOpConstraintDateTime Timestamp of Start or Finish Constraint
		 * @param {Date} dOpStarOrEndtDateTime Timestamp of Order Start or Finish
		 * @returns {String} Fill Constant
		 */
		getOpConstraintFill: function (sConstraintType, dOpConstraintDateTime, dOpStarOrEndtDateTime) {
			switch (sConstraintType) {
			case "1":
				//"Must start on" or "Must finish on"
				if (JSON.stringify(dOpConstraintDateTime) === JSON.stringify(dOpStarOrEndtDateTime)) {
					return "@sapTextColor";
				} else {
					return "@sapNegativeColor";
				}
			case "2":
				//"Cannot start before" or "Cannot finish before"
				if (dOpConstraintDateTime < dOpStarOrEndtDateTime) {
					return "@sapTextColor";
				} else {
					return "@sapNegativeColor";
				}
			case "3":
				//"Cannot start later" or "Finish not later"
				if (dOpConstraintDateTime > dOpStarOrEndtDateTime) {
					return "@sapTextColor";
				} else {
					return "@sapNegativeColor";
				}
			case "4":
				return "@sapTextColor";
			default:
				return "@sapTextColor";
			}
		},

		_formatToLocale: function (dDateTime) {
			if (!this._oDateFormatter) {
				this._oDateFormatter = sap.ui.core.format.DateFormat.getDateTimeInstance({
					locale: sap.ui.getCore().getConfiguration().getLocale()
				});
			}
			if (dDateTime) {
				return this._oDateFormatter.format(dDateTime);
			} else {
				return dDateTime;
			}
		},

		/** 
		 * returns the color code by processing status
		 * @param {string} sProcessingStatus processing status
		 * @returns {color} color code
		 */
		getColor: function (sProcessingStatus) {
			switch (sProcessingStatus) {
			case this.DISPATCHED:
				//green color
				return "@sapPositiveColor";
			case this.DUE:
				//yellow color
				return "@sapCriticalColor";
			default:
				//gray color
				return "@sapNeutralColor";
			}
		},

		/*
		 * Clicked the Cancel Dispatch button
		 * @param {formatActivityType,activityTypeName} The concatenated display for activity type column in operation table.
		 */
		formatActivityType: function (formatActivityType, activityTypeName) {
			if (formatActivityType && activityTypeName) {
				return activityTypeName + " (" + formatActivityType + ")";
			} else {
				return undefined;
			}
		},

		/*
		 * Enable/Disable DND for SubOperation &  In process
		 * @param {sSubOperation,sProcessingStatus} 
		 */
		isDNDPossible: function (sSubOperation, sProcessingStatus) {
			if (sSubOperation === "" && sProcessingStatus !== Constants.inProcessCode) {
				return true;
			} else {
				return false;
			}
		},

		/** Enable/Disable Connector Points for Operations 
		 * depending on the setting is on/off
		 * @public
		 * @param {Boolean} [bShowImpRel] Show Implicit Relationship
		 * @param {Boolean} [bShowExpRel] Show Explicit Relationship
		 * @param {String} [sSubOperation] Sub Operation
		 * @param {String} [sProcessingStatus] Processing Status
		 * @return {Boolean} Flag for connector point
		 **/
		isConnectable: function (bShowImpRel, bShowExpRel, sSubOperation, sProcessingStatus) {
			if ((bShowImpRel || bShowExpRel) && sSubOperation === "" && sProcessingStatus !== Constants.inProcessCode) {
				return true;
			} else {
				return false;
			}
		},

		/**
		 * Similar to onAfterRendering, but this hook is invoked before the controller's View is re-rendered
		 * (NOT before the first rendering! onInit() is used for that one!).
		 * @memberOf rsh.eam.ordergantts1.view.SchedulingBoard
		 */
		//	onBeforeRendering: function() {
		//
		//	},

		/**
		 * Called when the View has been rendered (so its HTML is part of the document). Post-rendering manipulations of the HTML could be done here.
		 * This hook is the same one that SAPUI5 controls get after being rendered.
		 * @memberOf rsh.eam.ordergantts1.view.SchedulingBoard
		 */
		onAfterRendering: function () {
			if (!this._bAdjustToolbar) { //manipulating the gantt toolbar to have the settings button at the standard place
				var _oGanttChartContainer = this.getView().byId("idOrderGanttContainer");
				var _oBtnSettings = this.byId("idCustomGanttSettingBtn");
				var _oToolbar = _oGanttChartContainer.getToolbar();
				_oToolbar.removeContent(_oBtnSettings);
				_oToolbar.insertContent(_oBtnSettings, _oToolbar.getContent().length);
				_oToolbar.removeContent(_oToolbar.oToolbarSpacer);
				_oToolbar.oToolbarSpacer = null;
				this._bAdjustToolbar = true;
			}
		},

		_initBindingEventHandlers: function () {
			var oBinding = this.getView().byId("idOrderTreeTable").getBinding("rows");
			this.getView().byId("idOrderTreeTable").attachToggleOpenState(this._onExpandRow, this);
			oBinding.attachEvent("dataReceived", function (oEvent) {
				var count = oBinding.oLengths.null;
				//Updating the order count when filtered.
				var oUIModel = this.getOwnerComponent().getModel("UIModel");
				oUIModel.setProperty("/rowCount", count);
				var bCalledDuringInitialization = false;
				//check whether it is a paging request
				//e.g. if an order has 250 operations and an expand of it is done, we need
				//to ensure for each batch of paging requestst to select all 250 operations 
				// we don't send Select fields for the order header
				if (oEvent.getParameters().data) {
					var iReceivedNumberOfSubnodes = oEvent.getParameters().data.results.length;
					var iCountOfTotalSubnodes = oEvent.getParameters().data.__count;
					if (iReceivedNumberOfSubnodes < iCountOfTotalSubnodes) {
						this._bPagingRequestOfSubnodes = true;
					} else {
						this._bPagingRequestOfSubnodes = false;
						//if no further pagiging requests of operations are expected,
						// we need to set $select params for orders again in oBinding.sCustomParams as the next request will be for order lavel 
						if (oEvent.getParameters().data && oEvent.getParameters().data.results.length) {
							if (oEvent.getParameters().data.results[0].OrderOperationRowLevel === 1) {
								this.setFinalSelectForOrderRequest(bCalledDuringInitialization);
							}
						}
					}
				}

			}.bind(this));

			oBinding.attachChange(this._onChange, this);

		},

		/*
		 * Expanding a row in Gantt attach MaintenanceOrderFilter on to improve performance
		 * as the annotation key OrderOperationParentRowID is a calculated key and takes long within DB select
		 * @public
		 * @param {object} [oEvent] expand event
		 */
		_onExpandRow: function (oEvent) {
			//continue only if expand is done and not collapse
			if (oEvent.getParameters().expanded === true) {
				var sMaintenanceOrderID = oEvent.getParameters().rowContext.getProperty().MaintenanceOrder;

				var aMaintenanceOrderIDs = [];
				aMaintenanceOrderIDs.push(sMaintenanceOrderID);
				this._addPerformanceFilterOnExpand(aMaintenanceOrderIDs);
			}
		},

		/*
		 * Attach MaintenanceOrderFilter on expanding a row in Gantt to improve performance
		 * as the annotation key OrderOperationParentRowID is a calculated key and takes long within DB select
		 * called if user expands a single raw and if multi expand vie expand + button is done
		 * @public
		 * @param {array} [aMaintenanceOrderIDs] Maintenance Order IDs
		 */
		_addPerformanceFilterOnExpand: function (aMaintenanceOrderIDs) {
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var oBinding = oTreeTable.getBinding("rows");
			var sMaintenanceOrderFilter = null;

			//always get the current filter from the binding as the filters may be changed by the user any time
			this._sExistingFilterString = oBinding.sFilterParams;
			//in case a previous expand was done, remove the previous expand filter before building new
			if (this._sPerformanceFilterOnExpand) {
				this._sExistingFilterString = this._sExistingFilterString.substr(this._sPerformanceFilterOnExpand.length);
			}

			for (var i = 0; i < aMaintenanceOrderIDs.length; i++) {
				if (aMaintenanceOrderIDs.length === 1) {
					sMaintenanceOrderFilter = "MaintenanceOrder eq '" + aMaintenanceOrderIDs[i] + "' and ";
					sMaintenanceOrderFilter = encodeURIComponent(sMaintenanceOrderFilter);
					oBinding.sFilterParams = sMaintenanceOrderFilter + this._sExistingFilterString;
					this._sPerformanceFilterOnExpand = sMaintenanceOrderFilter;
					// add a bracket before the first entry	
				} else if (i === 0) {
					sMaintenanceOrderFilter = "(" + "MaintenanceOrder eq '" + aMaintenanceOrderIDs[i] + "' or ";
					// add a bracket after the last entry		
				} else if (i === (aMaintenanceOrderIDs.length - 1)) {
					sMaintenanceOrderFilter = sMaintenanceOrderFilter + "MaintenanceOrder eq '" + aMaintenanceOrderIDs[i] + "')";
				} else {
					sMaintenanceOrderFilter = sMaintenanceOrderFilter + "MaintenanceOrder eq '" + aMaintenanceOrderIDs[i] + "' or ";
				}
			}

			if (aMaintenanceOrderIDs.length !== 1) {
				sMaintenanceOrderFilter = encodeURIComponent(sMaintenanceOrderFilter);
				oBinding.sFilterParams = sMaintenanceOrderFilter + "%20and%20" + this._sExistingFilterString;
				this._sPerformanceFilterOnExpand = sMaintenanceOrderFilter + "%20and%20";
			}
		},

		/*
		 * Determines visible columns from app state to be used in $select query to request orders & operations
		 * @public
		 * @param {boolean} [bGetForOrders] get fields for order request, otherwise for operations
		 */
		_determineVisibleColumnsFromAppState: function (bGetForOrders, bCalledDuringInitialization, sManualAddedColumnName) {
			var oAppState = null;
			var aVisibleColumnsFinal = [];
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			//to save some performance get the visible columns only from app state during initialization
			if (bCalledDuringInitialization) {
				oAppState = this._oAppStateData.customData;
				aVisibleColumnsFinal = oAppState.aVisibleColumns;
				// in all other cases just get it from the Gantt table	
			} else {

				var oColumns = oTreeTable.getColumns();
				for (var m = 0; m < oColumns.length; m++) {
					if (oColumns[m].getVisible()) {
						aVisibleColumnsFinal.push({
							"pos": m,
							"width": oColumns[m].getWidth(),
							"columnBindingName": oColumns[m].getSortProperty()
						});
					}
				}
			}

			var oManuallyAddedColumn;
			var bColumnDoesExist = false;

			//check whether the column does exist in the app state columns or not
			for (var k = 0; k < aVisibleColumnsFinal.length; k++) {
				if (aVisibleColumnsFinal[k].columnBindingName === sManualAddedColumnName) {
					bColumnDoesExist = true;
					break;
				}
			}
			//if column does not exist yet, add it
			if (sManualAddedColumnName && !bColumnDoesExist) {
				oManuallyAddedColumn = {
					pos: 25,
					width: "20%",
					columnBindingName: sManualAddedColumnName
				};
				aVisibleColumnsFinal[aVisibleColumnsFinal.length] = oManuallyAddedColumn;
			}

			if (bGetForOrders) {
				this._sOrderAppStateFields = "";
				for (var i = 0; i < aVisibleColumnsFinal.length; i++) {
					//some fields have multiple inputs e.g. duration and duration unit
					//therefore ensure both fields are part of $select
					switch (aVisibleColumnsFinal[i].columnBindingName) {
					case "MaintenanceOrder":
						//As maintenance order column is a mandatory once and cannot be removed, 
						//it is part of technical mandatory fields and doesn't need to be added here	
						break;
					case "MaintPriority":
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
							"MaintPriorityDesc";
						break;
					case "MaintenanceActivityType":
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
							"MaintenanceActivityTypeName";
						break;
					case "FunctionalLocationName":
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
							"FunctionalLocation";
						break;
					case "EquipmentName":
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
							"Equipment";
						break;
					case "TechnicalObjectDescription":
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
							"TechnicalObjectLabel";
						// Adding technical object type fields as those will be required to display correct data in the popover
						if (this._sOrderAppStateFields.indexOf("TechObjIsEquipOrFuncnlLoc") === -1) {
							this._sOrderAppStateFields = this._sOrderAppStateFields + "," +
								"TechObjIsEquipOrFuncnlLocDesc,TechObjIsEquipOrFuncnlLoc";
						}
						break;
					case "TechObjIsEquipOrFuncnlLocDesc":
						//Check if the technical object type fields is already added
						if (this._sOrderAppStateFields.indexOf("TechObjIsEquipOrFuncnlLoc") === -1) {
							this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
								"TechObjIsEquipOrFuncnlLoc";
						}
						break;
					case "MaterialStatusText":
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
							"MaterialStatus";
						break;
					case "OperationDuration":
						//don't add operation duration field as it is an operation field and shall be empty for order row
						break;
					case "OperationPlannedWork":
						//don't add planned work field as it is an operation field and shall be empty for order row
						break;
					case "OperationControlKey":
						//don't add control key field as it is an operation field and shall be empty for order row
						break;
					case "PlannedStartDate":
						//don't add planned start date field as it is an operation field and shall be empty for order row 
						break;
					case "PlannedEndDate":
						//don't add planned end date field as it is an operation field and shall be empty for order row 
						break;
					case "PlannedStartTime":
						//don't add planned start time field as it is an operation field and shall be empty for order row 
						break;
					case "PlannedEndTime":
						//don't add planned end time field as it is an operation field and shall be empty for order row 
						break;
					case "MaintOpExecutionStageName":
						//don't add execution stage name field as it is an operation field and shall be empty for order row 
						break;
					case "MaintOpExecStageShortText":
						//don't add execution stage description field as it is an operation field and shall be empty for order row 
						break;
					case "OperationPersonResponsible":
						//don't add person responsible field as it is an operation field and shall be empty for order row 
						break;
					case "OperationPersonRespName":
						//don't add person responsible field as it is an operation field and shall be empty for order row 
						break;
					case "NumberOfCapacities":
						//don't add number of capacities field as it is an operation field and shall be empty for order row 
						break;
					case "MaintOrdProcessPhaseCode":
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
							"MaintOrdProcessPhaseDesc";
						break;
					case "MaintOrdProcessSubPhaseCode":
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName + "," +
							"MaintOrdProcessSubPhaseDesc";
						break;
					case "ProcessingStatus":
						//don't add processing status field as it is part of technially mandatory field list already
						break;
					case "OperationHasLongText":
						//don't add operation long text as it is an operation field only
						break;
					case "HasError":
						//don't add has error as it is an operation field only
						break;
					default:
						this._sOrderAppStateFields = this._sOrderAppStateFields + "," + aVisibleColumnsFinal[i].columnBindingName;
						break;
					}

					if (this._sOrderAppStateFields.startsWith(",", 0)) {
						this._sOrderAppStateFields = this._sOrderAppStateFields.substring(1);
					}
				}
				//because some operation fields have different names but are filled into order fields in Gantt
				//filed name translation is required in some cases for &select operation requests
				//furthermore some fields have multiple inputs e.g. duration and duration unit
				//therefore ensure both fields are part of $select
			} else {
				this._sOperationAppStateFields = "";
				for (var j = 0; j < aVisibleColumnsFinal.length; j++) {
					switch (aVisibleColumnsFinal[j].columnBindingName) {
					case "MainWorkCenter":
						//don't add work center field as it is part of technially mandatory field list already
						break;
					case "MaintOrdProcessPhaseCode":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," +
							"MaintOrdOpProcessPhaseCode" + "," + "MaintOrdOpProcessPhaseDesc";
						break;
					case "MaintOrdProcessSubPhaseCode":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," +
							"MaintOrdOpProcessSubPhaseCode" + "," + "MaintOrdOpProcessSubPhaseDesc";
						break;
					case "MaintenanceOrder":
						//don't add processing status field as it is part of technially mandatory field list already (needed as there for implicit sorting by key)
						break;
					case "ProcessingStatus":
						//don't add processing status field as it is part of technially mandatory field list already
						break;
					case "MaintPriority":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"MaintPriorityDesc";
						break;
					case "OrderSystemConditionText":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"OperationSystemCondition,OperationSystemConditionText";
						break;
					case "MaintenanceActivityType":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"MaintenanceActivityTypeName";
						break;
					case "FunctionalLocationName":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"FunctionalLocation,OperationFunctionalLocation,OpFunctionalLocationName";
						break;
					case "EquipmentName":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"Equipment,OperationEquipment,OperationEquipmentName";
						break;
					case "TechnicalObjectDescription":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"TechnicalObjectLabel,OperationTechnicalObjectLabel,OperationTechnicalObjectDesc";
						// Adding technical object type fields as it will be required to do show correct data in the popover 
						if (this._sOperationAppStateFields.indexOf("OpTechObjEquipOrFuncnlLoc") === -1) {
							this._sOperationAppStateFields = this._sOperationAppStateFields + "," +
								"TechObjIsEquipOrFuncnlLoc,TechObjIsEquipOrFuncnlLocDesc,OpTechObjEquipOrFuncnlLoc,OpTechObjEquipOrFuncnlLocDesc";
						}
						break;
					case "TechObjIsEquipOrFuncnlLocDesc":
						//Check if the technical object type fields is already added
						if (this._sOperationAppStateFields.indexOf("OpTechObjEquipOrFuncnlLoc") === -1) {
							this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
								"TechObjIsEquipOrFuncnlLoc,OpTechObjEquipOrFuncnlLoc,OpTechObjEquipOrFuncnlLocDesc";
						}
						break;
					case "OperationDuration":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"OperationDurationUnit";
						break;
					case "OperationPlannedWork":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"OperationPlannedWorkUnit";
						break;
					case "MaterialStatusText":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"MaterialStatus";
						break;
					case "MaintOrdBasicStartDate":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"OrderStartDateTime";
						break;
					case "MaintOrdBasicEndDate":
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName + "," +
							"OrderEndDateTime";
						break;
					default:
						this._sOperationAppStateFields = this._sOperationAppStateFields + "," + aVisibleColumnsFinal[j].columnBindingName;
						break;
					}
				}
			}
		},

		/*
		 * creates final $select for operations query and sets it into sCustomParams of the rows binding
		 * @public
		 */
		setFinalSelectForOperationRequest: function () {
			var bGetForOrders = false;
			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var oBinding = oTreeTable.getBinding("rows");
			var bCalledDuringInitialization = false;
			var sSelectSubString = "";
			var sExpandSubString = "";

			this._determineVisibleColumnsFromAppState(bGetForOrders, bCalledDuringInitialization);
			this._sSelectString = "$select=" + this._sOperationAllTechMandatoryFields + this._sOperationAppStateFields;
			//add to_Relationships association only if relationships user setting is active to save some performance reading relationships
			if (oUIModel.getProperty("/showImpRel") || oUIModel.getProperty("/showExpRel")) {
				sSelectSubString = "to_Relationships";
				sExpandSubString = "&$expand=to_Relationships";
			}
			if (oUIModel.getProperty("/showUtilizationIndicator")) {
				sSelectSubString = sSelectSubString ? sSelectSubString + "," + "to_UtilIndicator" : "to_UtilIndicator";
				sExpandSubString = sExpandSubString ? sExpandSubString + "," + "to_UtilIndicator" : "&$expand=to_UtilIndicator";
			}
			oBinding.sCustomParams = sSelectSubString ? this._sSelectString + "," + sSelectSubString + sExpandSubString : this._sSelectString;
		},

		/*
		 * creates final $select for order query and sets it into sCustomParams of the rows binding
		 * @public
		 */
		setFinalSelectForOrderRequest: function (bCalledDuringInitialization, sManualAddedColumnName) {
			var bGetForOrders = true;
			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var oBinding = oTreeTable.getBinding("rows");
			var sSelectSubString = "";
			var sExpandSubString = "";

			this._determineVisibleColumnsFromAppState(bGetForOrders, bCalledDuringInitialization, sManualAddedColumnName);

			//sting from the app state can be empty in case all columns are hidden except Maintenance Order column
			if (this._sOrderAppStateFields) {
				this._sSelectString = "$select=" + this._sOrderAllTechMandatoryFields + "," + this._sOrderAppStateFields;
			} else {
				this._sSelectString = "$select=" + this._sOrderAllTechMandatoryFields;
			}

			//add to_Relationships association only if relationships user setting is active to save some performance reading relationships
			if (oUIModel.getProperty("/showImpRel") || oUIModel.getProperty("/showExpRel")) {
				sSelectSubString = "to_Relationships";
				sExpandSubString = "&$expand=to_Relationships";
			}
			if (oUIModel.getProperty("/showUtilizationIndicator")) {
				sSelectSubString = sSelectSubString ? sSelectSubString + "," + "to_UtilIndicator" : "to_UtilIndicator";
				sExpandSubString = sExpandSubString ? sExpandSubString + "," + "to_UtilIndicator" : "&$expand=to_UtilIndicator";
			}
			oBinding.sCustomParams = sSelectSubString ? this._sSelectString + "," + sSelectSubString + sExpandSubString : this._sSelectString;

			//set back the sorter for treetable to sorting of order fields to make sure to correct order by is in the request
			if (oBinding.aSorters && oBinding.aSorters.length >= 1 && oBinding.aSorters[0].sPath === this.sSortOperationField) {
				oBinding.aSorters[0].sPath = this.sSortOrderField;
				oBinding.aSorters[0].bDescending = this.sOrderSortOrder === "Descending" ? true : false;
			}
		},

		/*
		 * called each time binding of Gantt rows is changed
		 * @public
		 */
		_onChange: function (oEvent) {
			var eventParam = oEvent.getParameters();
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var oBinding = oTreeTable.getBinding("rows");

			//If expand is pressed, then the next batch request will be for the operations.
			//Hence $select order header specific fields shall not be part of the batch request
			//This is due to analytical CDS view logic applied on smart filter based on operation fields
			//instead pass $selec fields for operation request
			if (eventParam && eventParam.reason === "expand") {

				this.setFinalSelectForOperationRequest();

				//Because dataReceived event of the first paging request is raised after the _onChange of the second page is called,
				//we need to assume as default that there will be more than one paging request
				//If this is not the case, it will be re-validated in the function handler of dataReceived event
				//see above in _initBindingEventHandlers
				this._bPagingRequestOfSubnodes = true;

				//consider operation sort while expanding as well
				//this condition is for when the filter go is pressed and the sorting is reset
				//table column sorting order is set with  RowLevel = 0 field values
				if (oTreeTable.getSortedColumns().length !== 0) {
					if (this._afilterFieldGroups.indexOf(oTreeTable.getSortedColumns()[0].getSortProperty()) !== -1 ||
						oTreeTable.getSortedColumns()[0].getSortProperty() === "MainWorkCenter" || oTreeTable.getSortedColumns()[0].getSortProperty() ===
						"MaintOrdProcessPhaseCode" ||
						oTreeTable.getSortedColumns()[0].getSortProperty() === "MaintOrdProcessSubPhaseCode" ||
						oTreeTable.getSortedColumns()[0].getSortProperty() === "MaintenanceOrder") {
						oBinding.aSorters[0].sPath = this.sSortOperationField;
						oBinding.aSorters[0].bDescending = this.sOperationSortOrder === "Descending" ? true : false;
					}
					//in case sorting was done befor expand, oTreeTable.getSortedColumns() is empty,
					//hence oBinding.aSorters needs to be checked in addition
				} else if (oBinding.aSorters.length !== 0) {
					if (oBinding.aSorters[0].sPath === "MainWorkCenter" ||
						oBinding.aSorters[0].sPath === "MaintOrdProcessPhaseCode" ||
						oBinding.aSorters[0].sPath === "MaintOrdProcessSubPhaseCode" ||
						oBinding.aSorters[0].sPath === "MaintenanceOrder") {
						oBinding.aSorters[0].sPath = this.sSortOperationField;
						oBinding.aSorters[0].bDescending = this.sOperationSortOrder === "Descending" ? true : false;
					}
				}
			} else if (eventParam && eventParam.reason === "sort") {
				// For RowLevel = 0, onChange method is triggered but no need to change anything.
				// For RowLevel = 1, sort binding path is changed only for the operation columns.
				if (this._afilterFieldGroups.indexOf(this.sSortOperationField) !== -1 || this.sSortOperationField === "WorkCenter" ||
					this.sSortOperationField === "MaintenanceOrderOperation" || this.sSortOperationField === "OpFunctionalLocationName" ||
					this.sSortOperationField === "OperationEquipmentName" || this.sSortOperationField === "OperationTechnicalObjectDesc" ||
					this.sSortOperationField === "OperationSystemConditionText" || this.sSortOperationField === "MaintOrdOpProcessPhaseCode" || this.sSortOperationField ===
					"MaintOrdOpProcessSubPhaseCode") {
					oBinding.aSorters[0].sPath = this.sSortOperationField;
					oBinding.aSorters[0].bDescending = this.sOperationSortOrder === "Descending";
				}
				//set $select for operation request
				this.setFinalSelectForOperationRequest();
			}
			//Raise an event to which other functions can subscribe if an individual action is needed at this point of time 
			//but should not always be done when _onChange is executed or cannot be identified properly with other values
			sap.ui.getCore().getEventBus().publish(this.sOrderGanttChannel, this.sIndiviudalActionOnGanttChange, this);
			
			if (this._bActionInitiatedFromContextMenu === true) {
				this.updateToolbarButtonsFromSelectedRows();
				this._bActionInitiatedFromContextMenu = false;
			}
		},

		/** 
		 * Common method to set the FilterBar with filter values from navigation params
		 * @public
		 */
		setNavParamstoFilterBar: function () {
			var oStartupParameters = this._oOwnerComponent.getComponentData().startupParameters;
			var oJSONData = {};
			var oSmartFilter = this.getView().byId("idOrderGanttSmartFilterBar");

			/* Commenting this part as it is not needed presently but might be needed in future implementations as suggested by Kritika
			// if (this._oOwnerComponent.oGlobalFilter) {
			// 	if (this._oOwnerComponent.oGlobalFilter.selectionVariantOptions &&
			// 		this._oOwnerComponent.oGlobalFilter.selectionVariantOptions.length > 0) {
			// 		var navSelectionVariant = new sap.ui.comp.state.UIState();
			// 		navSelectionVariant.setSelectionVariant({
			// 			"SelectionVariantID": "",
			// 			"SelectOptions": this._oOwnerComponent.oGlobalFilter.selectionVariantOptions
			// 		});
			// 		this._oOwnerComponent.oGlobalFilter.selectionVariantOptions.forEach(function (oSelOption) {
			// 			if (oSmartFilter.getControlByKey(oSelOption.PropertyName)) {
			// 				oSmartFilter.addFieldToAdvancedArea(oSelOption.PropertyName);
			// 			}
			// 		});
			// 		oSmartFilter.setUiState(navSelectionVariant, {
			// 			replace: true,
			// 			strictMode: false
			// 		});
			// 	}
			// }
			*/

			if (oStartupParameters) {
				oJSONData = this.getGlobalFilter(oStartupParameters, oJSONData);
			}

			Object.keys(oStartupParameters).forEach(function (key, index) {
				if (oSmartFilter.getControlByKey(key)) {
					oSmartFilter.addFieldToAdvancedArea(key);
				}
			});

			oSmartFilter.setFilterData(oJSONData);
			oSmartFilter.getVariantManagement().currentVariantSetModified(true);
		},

		/** 
		 * Get filters to be set in FilterBar from startup parameters
		 * @param {Json} oStartupParameters startup parameters
		 * @param {Json} oJSONData filter data
		 * @returns {Json} oFinJSONData final filter data
		 */
		getGlobalFilter: function (oStartupParameters, oJSONData) {
			var aItems = [];
			var oPriorityValue = {};
			var oStatusValue = {};
			var oWorkCenterValue = {};

			// Pick Priority parameter from Startup Parameters
			if (oStartupParameters.MaintPriority) {
				oPriorityValue.key = oStartupParameters.MaintPriority[0];

				if (oStartupParameters.MaintPriorityDesc) {
					oPriorityValue.text = oStartupParameters.MaintPriorityDesc[0];
				} else {
					oPriorityValue.text = oPriorityValue.key;
				}
				aItems.push(oPriorityValue);
				if (!oJSONData.MaintPriority) {
					oJSONData.MaintPriority = {};
				}
				oJSONData.MaintPriority.items = aItems;
			}
			aItems = [];
			// Pick Processing Status from Startup Parameters
			if (oStartupParameters.ProcessingStatus) {
				oStatusValue.key = oStartupParameters.ProcessingStatus[0];
				aItems.push(oStatusValue);
				if (!oJSONData.ProcessingStatus) {
					oJSONData.ProcessingStatus = {};
				}
				oJSONData.ProcessingStatus.items = aItems;
			}
			aItems = [];
			// Pick WorkCenter from Startup Parameters
			if (oStartupParameters.WorkCenter) {
				oWorkCenterValue.key = oStartupParameters.WorkCenter[0];
				oWorkCenterValue.text = oStartupParameters.WorkCenter[0];
				aItems.push(oWorkCenterValue);
				if (!oJSONData.WorkCenter) {
					oJSONData.WorkCenter = {};
				}
				oJSONData.WorkCenter.items = aItems;
			}

			// While navigating into this app with Maintenance Order (e.g. from Order tab of Details App)
			if (oStartupParameters.MaintenanceOrder) {
				if (!oJSONData.MaintenanceOrder) {
					oJSONData.MaintenanceOrder = {};
				}
				oJSONData.MaintenanceOrder.items = [];
				var sMaintenanceOrders = decodeURIComponent(oStartupParameters.MaintenanceOrder);
				var aMaintenanceOrders = sMaintenanceOrders.split(",");
				aMaintenanceOrders.forEach(function pushOrder(item) {
					oJSONData.MaintenanceOrder.items.push({
						"key": item,
						"text": item
					});
				});

			}

			// Pick PeriodType from Startup Parameters
			if (oStartupParameters.PeriodType) {
				var oFinJSONData = this.getPeriodTypeData(oStartupParameters, oJSONData);
			}

			return oFinJSONData;

		},

		/** 
		 * Returns the Date range for given startup parameters and current filter data
		 * @param {Object} oStartupParameters  Startup paramters
		 * @param {Object} oJSONData  Current filter data
		 * @returns {Object} updated date range filter data based on startup paramters
		 */
		getPeriodTypeData: function (oStartupParameters, oJSONData) {
			var oRanges = {};
			var conditionTypeInfo = {};
			conditionTypeInfo.data = {};
			var oStartDateNext = new Date();
			var oEndDateNext = new Date();
			var oStartDatePast = new Date();
			var oEndDatePast = new Date();
			var aItems = [];
			oEndDatePast.setDate(oEndDatePast.getDate() - 1);
			// Set the date to today + 4 weeks
			// Then set it to the previous Sunday
			oEndDateNext.setDate(oEndDateNext.getDate() + 28);
			oEndDateNext.setDate(oEndDateNext.getDate() - (oEndDateNext.getDay() + 7) % 7);
			oStartDatePast.setMonth(oStartDatePast.getMonth() - 6);

			if (oStartupParameters.PeriodType) {
				conditionTypeInfo.name = "custom.oDateRange";
				conditionTypeInfo.data.calendarType = "Gregorian";
				conditionTypeInfo.data.key = "PeriodType";

				if (oStartupParameters.PeriodType[0] === "FUTURE") { // next 4 week
					conditionTypeInfo.data.operation = "FISCALPERIOD0";
					oRanges.Operations = "BT";
					oRanges.value1 = oStartDateNext;
					oRanges.value2 = oEndDateNext;
				} else if (oStartupParameters.PeriodType[0] === "PAST") { // past 6 months
					conditionTypeInfo.data.operation = "DATERANGE";
					conditionTypeInfo.data.value1 = oStartDatePast;
					conditionTypeInfo.data.value2 = oEndDatePast;
					oRanges.Operations = "BT";
					oRanges.value1 = oStartDatePast;
					oRanges.value2 = oEndDatePast;
				} else if (oStartupParameters.PeriodType[0] === "CUSTOM") { // custom
					this._getCustomPeriodDate(oStartupParameters, oStartDateNext, oEndDateNext, conditionTypeInfo, oRanges, "DATERANGE");
				} else if (oStartupParameters.PeriodType[0] === "CUSTOM_TODAYFROMTO") {
					this._getCustomPeriodDate(oStartupParameters, oStartDateNext, oEndDateNext, conditionTypeInfo, oRanges, "TODAYFROMTO");
				}
				aItems.push(oRanges);
				if (!oJSONData.PeriodType) {
					oJSONData.PeriodType = {};
				}
				oJSONData.PeriodType.ranges = aItems;
				oJSONData.PeriodType.conditionTypeInfo = conditionTypeInfo;
			}
			return oJSONData;

		},
		_getCustomPeriodDate: function (oStartupParameters, oStartDateNext, oEndDateNext, conditionTypeInfo, oRanges, sOperation) {
			if (oStartupParameters.PeriodStartDate && oStartupParameters.PeriodEndDate) {
				if (sOperation === "DATERANGE") {
					oStartDateNext = this.getValidDate(decodeURIComponent(oStartupParameters.PeriodStartDate[0]));
					oEndDateNext = this.getValidDate(decodeURIComponent(oStartupParameters.PeriodEndDate[0]));
					if (oStartDateNext && oEndDateNext) {
						// we got everything - CUSTOM Period with start and end date. Set the filter accordingly
						conditionTypeInfo.data.operation = sOperation;
						conditionTypeInfo.data.value1 = oStartDateNext;
						conditionTypeInfo.data.value2 = oEndDateNext;
						oRanges.Operation = "BT";
						oRanges.value1 = oStartDateNext;
						oRanges.value2 = oEndDateNext;
						oRanges.exclude = false;
						oRanges.keyField = "PeriodType";
					}
				} else {
					conditionTypeInfo.data.operation = sOperation;
					conditionTypeInfo.data.value1 = oStartupParameters.PeriodStartDate[0];
					conditionTypeInfo.data.value2 = oStartupParameters.PeriodEndDate[0];
					oRanges.Operation = "BT";
					oRanges.value1 = oStartupParameters.PeriodStartDate[0];
					oRanges.value2 = oStartupParameters.PeriodEndDate[0];
					oRanges.exclude = false;
					oRanges.keyField = "PeriodType";
				}
			}
		},

		/** 
		 * Converts Date String strigified from date object which is passed as arguement to YYYYMMDD format and returns it
		 * @param {string} dateString String date that needs to be converted to date object in YYYYMMDD format
		 * @returns {string} Parsed Date object in Gateway oData format (best for filter conditions)
		 */
		getValidDate: function (dateString) {
			var dDateObject = new Date(dateString);
			if (dDateObject instanceof Date && !isNaN(dDateObject)) {
				return Utils.convertDateToGatewayString(dDateObject);
			} else {
				return null;
			}
		},

		_initTreeTableBinding: function () {
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			oTreeTable.bindRows({
				path: "/C_RSHOrdersAndOperations",
				parameters: {
					treeAnnotationProperties: {
						hierarchyLevelFor: "OrderOperationRowLevel",
						hierarchyNodeFor: "OrderOperationRowID",
						hierarchyParentNodeFor: "OrderOperationParentRowID",
						hierarchyDrillStateFor: "OrderOperationIsExpanded"
					},
					gantt: {
						rowIdName: "OrderOperationRowID"
					},
					groupId: "iDBatchOrderFilterRequest"
				}
			});
			var bCalledDuringInitialization = true;
			this.setFinalSelectForOrderRequest(bCalledDuringInitialization);
		},

		/**
		 * Formatter method for adding initial time to calendar date
		 * @public
		 * @param {Date} [dCalendarDate] Calendar Date
		 * @returns {Date} formatted date
		 */
		formatStartTime: function (dCalendarDate) {
			if (dCalendarDate) {
				var oDate = this.removeTimeZoneOffset(dCalendarDate);
				oDate.setHours(0, 0, 0, 0);
				return oDate;
			}
			return "";
		},

		/**
		 * Colour formatter for utilization shapes based on values of utilization
		 * @public
		 * @param {Float} [fWorkCenterUtilization] Utilization percentage
		 * @returns {String} semantic colour for indicating the percentage
		 */
		getUtilizationColor: function (fWorkCenterUtilization) {
			if (fWorkCenterUtilization >= 0 && fWorkCenterUtilization < 75) {
				return "@sapUiShellPositiveColor";
			}
			if (fWorkCenterUtilization >= 75 && fWorkCenterUtilization <= 100) {
				return "@sapUiShellCriticalColor";
			}
			if (fWorkCenterUtilization > 100) {
				return "@sapUiShellNegativeColor";
			}
			return "";
		},

		/* Formatter for Tooltip text of Utilization shapes
		 * @public
		 * @param {Float} [fWorkCenterUtilization] Utilization value
		 * @param {String} [sWorkCenterAvailableCapacity] Available Capacity in scientific notation
		 * @param {String} [sWorkCenterRequiredCapacity] Required Capacity in scientific notation
		 * @returns {String} Formatted Tooltip
		 */
		getTooltipForUtilization: function (fWorkCenterUtilization, sWorkCenterRequiredCapacity, sWorkCenterAvailableCapacity) {
			return this.getView().getModel("i18n").getResourceBundle().getText(
				"UtilizationTooltip", [Math.round(fWorkCenterUtilization), Math.round(parseFloat(sWorkCenterRequiredCapacity)), Math.round(
					parseFloat(sWorkCenterAvailableCapacity))]);
		},

		/**
		 * shapePress Event triggered on Pressing a shape. Additionally, selectable needs to be enabled for the shape.
		 * Selects the row for shapes aggregation of shapes1
		 * @public
		 * @param {Object} [oEvent] Event object
		 */
		/*onShapePressed: function (oEvent) {
			var oShape = oEvent.getParameter("shape");
			if (oShape && oShape.sParentAggregationName === "shapes") {
				var oTreeTable = oEvent.getSource().getTable(); // This gets the tree table
				var oRow = oEvent.getParameter("rowSettings").getParent(); // This gets the row of selected shape
				var iRowIndexOfSelectedShape = oRow.getIndex(); //This gets index of the row of selected shape
				oTreeTable.addSelectionInterval(iRowIndexOfSelectedShape, iRowIndexOfSelectedShape);
			}
		},*/

		/*
		 * Lister for initializing the smart filter bar.
		 * @public
		 * @param {sap.ui.Event} [oEvent] event instance
		 */
		onInitSmartFilter: function (oEvent) {
			this._initTreeTableBinding();
			this._initBindingEventHandlers();
			//var oAdditionalDateRangeFilterBlock = this.getAdditionalDateRangeFilterBlock();
			var oBinding = this.getView().byId("idOrderTreeTable").getBinding("rows");
			//oBinding.filter(oAdditionalDateRangeFilterBlock, sap.ui.model.FilterType.Application);
			oBinding.refresh();
			this.setNavParamstoFilterBar();
		},

		getAdditionalDateRangeFilterBlock: function (bGetTimePeriod) {
			var oAdditionalDateRangeFilterBlock = {};
			var oPeriodTypeDates = {};
			if (Utils.isMockRun()) {
				return [];
			}

			var oFilterData = this.getView().byId("idOrderGanttSmartFilterBar").getFilterData();
			if (!oFilterData || (oFilterData && !oFilterData.PeriodType)) {
				oPeriodTypeDates = {
					oStartDate: new Date(),
					oEndDate: new Date()
				};

				oPeriodTypeDates.oEndDate.setDate(oPeriodTypeDates.oEndDate.getDate() + 28);
				oPeriodTypeDates.oEndDate.setDate(oPeriodTypeDates.oEndDate.getDate() - (oPeriodTypeDates.oEndDate.getDay() + 7) % 7);

			} else {
				oPeriodTypeDates = {
					// oStartDate: oFilterData.PeriodType.ranges[0].value1,
					// oEndDate: oFilterData.PeriodType.ranges[0].value2
					oStartDate: this.dateObjectCopy(oFilterData.PeriodType.ranges[0].value1),
					oEndDate: this.dateObjectCopy(oFilterData.PeriodType.ranges[0].value2)
				};
			}

			if (bGetTimePeriod) {
				return oPeriodTypeDates;
			}

			var oEarliestStartDateFilter = new sap.ui.model.Filter({
				path: "OpErlstSchedldExecStrtDte",
				value1: Utils.getAdjustedDate(oPeriodTypeDates.oEndDate),
				operator: "LE"
			});
			var oEarliestEndDateFilter = new sap.ui.model.Filter({
				path: "OpErlstSchedldExecEndDte",
				value1: Utils.getAdjustedDate(oPeriodTypeDates.oStartDate),
				operator: "GE"
			});
			var oLatestStartDateFilter = new sap.ui.model.Filter({
				path: "OpLtstSchedldExecStrtDte",
				value1: Utils.getAdjustedDate(oPeriodTypeDates.oEndDate),
				operator: "LE"
			});
			var oLatestEndDateFilter = new sap.ui.model.Filter({
				path: "OpLtstSchedldExecEndDte",
				value1: Utils.getAdjustedDate(oPeriodTypeDates.oStartDate),
				operator: "GE"
			});
			var oSchedulingIsPerformedBackward = new sap.ui.model.Filter({
				path: "SchedulingIsPerformedBackward",
				value1: "X",
				operator: "EQ"
			});
			var oSchedulingIsNotPerformedBackward = new sap.ui.model.Filter({
				path: "SchedulingIsPerformedBackward",
				value1: " ",
				operator: "EQ"
			});
			var oEarliestStartDateFilterMonths = new sap.ui.model.Filter({
				path: "OpErlstSchedldExecEndDte",
				value1: Utils.getAdjustedDate(oPeriodTypeDates.oEndDate),
				operator: "LE"
			});
			var oLatestStartDateFilterMonths = new sap.ui.model.Filter({
				path: "OpLtstSchedldExecEndDte",
				value1: Utils.getAdjustedDate(oPeriodTypeDates.oEndDate),
				operator: "LE"
			});

			var oEarliestFilterBlock = new sap.ui.model.Filter({
				filters: [oEarliestStartDateFilter, oEarliestEndDateFilter, oSchedulingIsNotPerformedBackward],
				and: true
			});
			var oLatestFilterBlock = new sap.ui.model.Filter({
				filters: [oLatestStartDateFilter, oLatestEndDateFilter, oSchedulingIsPerformedBackward],
				and: true
			});
			var oEarliestFilterBlockMonths = new sap.ui.model.Filter({
				filters: [oEarliestStartDateFilterMonths, oEarliestEndDateFilter, oSchedulingIsNotPerformedBackward],
				and: true
			});

			var oLatestFilterBlockMonths = new sap.ui.model.Filter({
				filters: [oLatestStartDateFilterMonths, oLatestEndDateFilter, oSchedulingIsPerformedBackward],
				and: true
			});

			if (!oFilterData || (oFilterData && !oFilterData.PeriodType)) {
				oAdditionalDateRangeFilterBlock = new sap.ui.model.Filter({
					filters: [oEarliestFilterBlock, oLatestFilterBlock],
					and: false
				});

			} else {
				var sOperation = oFilterData.PeriodType.conditionTypeInfo.data.operation;

				if (sOperation === "FISCALPERIOD1") {
					oAdditionalDateRangeFilterBlock = new sap.ui.model.Filter({
						filters: [oEarliestFilterBlockMonths, oLatestFilterBlockMonths],
						and: false
					});
				} else {
					oAdditionalDateRangeFilterBlock = new sap.ui.model.Filter({
						filters: [oEarliestFilterBlock, oLatestFilterBlock],
						and: false
					});
				}
			}
			return oAdditionalDateRangeFilterBlock;
		},

		/**
		 * Threshold for model data needs to be changed based on the time period.
		 * Default size limit is 100
		 * Change the default only if the time period is longer
		 * @private
		 */
		_setThresholdForModelData: function () {
			var oCurrentTimePeriod = this._getCurrentTimePeriod();
			var iDiffTime = Math.abs(oCurrentTimePeriod.sCalendarEndDate - oCurrentTimePeriod.sCalendarStartDate);
			var iDiffDays = Math.ceil(iDiffTime / (1000 * 60 * 60 * 24));
			if (iDiffDays > 100) {
				this._oOwnerComponent.getModel().setSizeLimit(iDiffDays);
			} else if (this._oOwnerComponent.getModel().iSizeLimit > 100) {
				this._oOwnerComponent.getModel().setSizeLimit(100);
			}
		},

		/**
		 * Handler for smart filter Go Press Event
		 * On application load which is this._bFirstTriggerDone,
		 * ensure that filter requests are only triggered for the search events raised by delayedTriggerSearch.
		 * @public
		 * @param {object} [oEvent] event paramneter 
		 */
		onFilter: function (oEvent) {
			sap.ui.getCore().getMessageManager().removeAllMessages();
			this._setTimeAxis();
			if (Utils.isMockRun()) {
				this.onInitSmartFilter();
				this._submitDelayedRequests();
				return;
			}
			if (!this._bFirstTriggerDone) {
				if (oEvent.getParameters() && oEvent.getParameters().hasOwnProperty("finalTrigger")) {
					this.applyAndTriggerFinalFilter(oEvent);
				} else {
					return;
				}
			} else {
				this.applyAndTriggerFinalFilter(oEvent);
			}
		},

		/**
		 * Helper for smart filter Go Press Event onFilter
		 * Populates the Sorters and Filters
		 * _bSubmitofDeferredRequestsDone helps in submitting deferred requests once, after which normal flow is restored.
		 * @public
		 * @param {object} [oEvent] event paramneter 
		 */
		applyAndTriggerFinalFilter: function (oEvent) {
			var oSmartFilter = this.getView().byId("idOrderGanttSmartFilterBar");
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var oBinding = oTreeTable.getBinding("rows");
			var oFiltersFromSmartFB = oSmartFilter.getFilters();
			var oAdditionalDateRangeFilterBlock = {};
			oAdditionalDateRangeFilterBlock = this.getAdditionalDateRangeFilterBlock();

			//Size Limit for Model Data
			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			if (oUIModel.getProperty("/showUtilizationIndicator") || oUIModel.getProperty("/showNonWorkingTimes")) {
				this._setThresholdForModelData();
			}

			// Reset sort variable to last use Order Sort 
			if (oBinding.aSorters.length > 0) {
				//if sort is preselected before the filtering is done it should be retained
				if (oTreeTable.getSortedColumns().length !== 0) {
					if (this._afilterFieldGroups.indexOf(oTreeTable.getSortedColumns()[0].getSortProperty()) !== -1 ||
						oTreeTable.getSortedColumns()[0].getSortProperty() === "WorkCenter" ||
						oTreeTable.getSortedColumns()[0].getSortProperty() === "MaintenanceOrderOperation") {
						this.sSortOperationField = oTreeTable.getSortedColumns()[0].getSortProperty();
						this.sOperationSortOrder = oTreeTable.getSortedColumns()[0].getSortOrder();
					}
				}
				//check if the current sort is for level=1 the set sort to the order level
				oBinding.aSorters[0].sPath = this.sSortOrderField;
				oBinding.aSorters[0].bDescending = this.sOrderSortOrder === "Descending";
			}

			if (oFiltersFromSmartFB && oFiltersFromSmartFB.length === 1) {
				var oMergedFilterBlock = new sap.ui.model.Filter({
					filters: [oFiltersFromSmartFB[0], oAdditionalDateRangeFilterBlock],
					and: true
				});
				var aExistingFilters = oMergedFilterBlock.aFilters[0].aFilters;
				var filterCount = 0;
				for (; filterCount < aExistingFilters.length; filterCount++) {
					if ((aExistingFilters[filterCount].sPath &&
							aExistingFilters[filterCount].sPath === "PeriodType") ||
						(aExistingFilters[filterCount].aFilters &&
							aExistingFilters[filterCount].aFilters[0].sPath === "PeriodType")) {
						aExistingFilters.splice(filterCount, 1);
						break;
					}
				}
				if (aExistingFilters.length === 0) {
					oMergedFilterBlock.aFilters.splice(0, 1);
				}
				//oFiltersFromSmartFB.push(oAdditionalDateRangeFilterBlock);
				oBinding.filter(oMergedFilterBlock, sap.ui.model.FilterType.Application);
			} else {
				oBinding.filter(oAdditionalDateRangeFilterBlock, sap.ui.model.FilterType.Application);
			}
			var bCalledDuringInitialization = false;
			// we need to ensure $select for order request is set in sCustomParams before the next request is done
			//as the user can expand an order and immediatelly click on Go in the smart filter bar without waiting until expand is done
			//we need to always set final $select for order header request explicitely on filtering flow
			this.setFinalSelectForOrderRequest(bCalledDuringInitialization);
			oBinding.refresh();
			this.bindCalendarDefHelper();
			if (!this._bSubmitofDeferredRequestsDone) {
				this._submitDelayedRequests();
			}
			//clear the performance filter on expand as on filter all rows will be collapsed
			this._sPerformanceFilterOnExpand = null;
			this.disableButtons();
		},

		/**
		 * When filter values change, we update the status text which is shown in collapsed header
		 * @private
		 * @param {Object} [oEvent] Event object 
		 */
		onAssignedFiltersChanged: function (oEvent) {
			var oSmartFilter = this.getView().byId("idOrderGanttSmartFilterBar");
			var oPeriodType = oSmartFilter.getControlByKey("PeriodType");

			if (oPeriodType && oPeriodType.getValueState() === sap.ui.core.ValueState.Error) {
				oPeriodType.setValueStateText(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("timePeriodFilterError"));
			}
			var oStatusText = this.getView().byId("statusText");
			var oFilterBar = oEvent.getSource();
			if (oStatusText && oFilterBar) {
				var sText = oFilterBar.retrieveFiltersWithValuesAsText();
				oStatusText.setText(sText);
			}
		},

		onAfterVariantLoad: function (oEvent) {
			var oSmartFilter = oEvent.getSource();
			var oContext = oEvent.getParameters().context;
			if (oContext === "INIT" && sap.ui.core.routing.HashChanger.getInstance().getCurrentNavigationState().oldHash.indexOf(
					"WorkCenterUtilization-display") !== -1) {
				oSmartFilter.clear();
				this.setNavParamstoFilterBar();
				var oParams = {
					finalTrigger: true
				};
				if (oSmartFilter.isCurrentVariantExecuteOnSelectEnabled() === true) {
					oSmartFilter.fireSearch(oParams);
				}
			}
			if ((!oContext && oSmartFilter.getControlByKey("PeriodType").getValue() === "") || (oContext === "RESET" && oSmartFilter.isCurrentVariantStandard())) {
				this.setDefaultDateRange();
			}
		},

		onSmartFilterInitialized: function (oEvent) {
			var oSmartFilter = oEvent.getSource();
			if (oSmartFilter.getCurrentVariantId() === "" && oSmartFilter.getControlByKey("PeriodType").getValue() === "") {
				this.setDefaultDateRange();
			}
			// retrieve the app state while navigating back from scheduling after the filter bar initialized.
			this._oAppStateInstance = AppState.getInstance();
			// Retreiving app state is an asynchronous call, returns a promise meanwhile onTableVariantInitialized event
			// will be executed by Order and operations table and make a delay triggered search. Hence a new calss variable 
			// _bIsAppStateApplied is introduced to make sure that appstate is applied before the search event triggered by filter bar.

			this._oAppStateInstance.retrieveAppState().then(function (oAppData, oStartupParameters, sNavType) {
				//sNavType will be x-appstate if it is the forward navigation, no need to apply the app state in this case.
				if (sNavType === sap.ui.generic.app.navigation.service.NavType.iAppState) {
					this._isIAppState = true;
					this.setAppState(oAppData);
					this._bIsAppStateApplied = true;
					this._delayedTriggerSearch();
				} else {
					this._isIAppState = false;
					this.setAppState(this._oAppStateData);
					this._bIsAppStateApplied = true;
					this._delayedTriggerSearch();
				}
			}.bind(this)).fail(function () { // Error handling
				this._bIsAppStateApplied = true;
				this._delayedTriggerSearch();
			}.bind(this));
		},

		/*to set the date range to default four weeks*/
		setDefaultDateRange: function () {
			var oJSONData = {};
			var oSmartFilter = this.getView().byId("idOrderGanttSmartFilterBar");
			var oPeriodType = oSmartFilter.getControlByKey("PeriodType");
			var oStartDateNext = new Date();
			var oEndDateNext = Utils.getEndDateNext();
			var oStartDate = oStartDateNext;
			var oEndDate = oEndDateNext;
			var conditionTypeInfo = {};
			conditionTypeInfo.data = {};
			oJSONData.PeriodType = {};

			conditionTypeInfo.name = "custom.oDateRange";
			conditionTypeInfo.data.calendarType = "Gregorian";
			conditionTypeInfo.data.key = "PeriodType";
			conditionTypeInfo.data.value1 = oStartDate;
			conditionTypeInfo.data.value2 = oEndDate;

			if (Utils.isMockRun() && oPeriodType.getSelectedKey() === "DATERANGE") {
				conditionTypeInfo.data.operation = "DATERANGE";
			} else {
				conditionTypeInfo.data.operation = "FISCALPERIOD0";
			}
			oJSONData.PeriodType.conditionTypeInfo = conditionTypeInfo;
			oSmartFilter.setFilterData(oJSONData);
		},

		/** 
		 * Make a copy of the date object without effecting the original date object
		 * @param {Date} oDate date that needs to be copyied
		 * @returns {Date} copy of date object
		 */
		dateObjectCopy: function (oDate) {
			return new Date(JSON.parse(JSON.stringify(oDate)));
		},

		getDatePerTimeAxisFormat: function (oDate) {
			var yyyy = oDate.getFullYear().toString();
			var MM = this.pad(oDate.getMonth() + 1, 2);
			var dd = this.pad(oDate.getDate(), 2);
			var hh = this.pad(oDate.getHours(), 2);
			var mm = this.pad(oDate.getMinutes(), 2);
			var ss = this.pad(oDate.getSeconds(), 2);

			return yyyy + MM + dd + hh + mm + ss;
		},

		pad: function (number, length) {

			var str = "" + number;
			while (str.length < length) {
				str = "0" + str;
			}

			return str;
		},

		/** 
		 * Usually called when sort is applied on the table columns.
		 * Expand on rowlevel = 0 for order column requires $select for order fields 
		 * hence reset the sCustomParams
		 * If called while applying app state then use oSortColumn for assignments
		 * @public
		 * @param {Object} [oEvent] Event object 
		 * @param {Object} [oSortColumn] Sort column information stored in App state
		 */
		onSortRequest: function (oEvent, oSortColumn) {
			var oBinding = this.getView().byId("idOrderTreeTable").getBinding("rows");
			//get the sorted column binding
			var sColumnBinding = null;
			var sColSortproperty = null;
			var sColSortOrder = null;
			var _oSorter, _aSorterColumns;
			if (oSortColumn) {
				//var aColumns = this.getView().byId("idOrderTreeTable").getColumns();
				//get the sorted column binding
				sColumnBinding = this.getView().byId(oSortColumn.id);
				//get the sorted column property
				sColSortproperty = oSortColumn.sortProperty;
				//get the sorted column sortOrder
				sColSortOrder = oSortColumn.sortOrder;
			} else {
				sColumnBinding = oEvent.getParameters("bindingParams").column;
				//get the sorted column property
				sColSortproperty = sColumnBinding.getSortProperty();
				//get the sorted column sortOrder
				sColSortOrder = oEvent.getParameters("bindingParams").sortOrder;
				this._onPersChangeForColumns(oEvent);
			}
			//Check if the selected column belongs to the operation fields.
			if (this._afilterFieldGroups.indexOf(sColSortproperty) >= 0) {
				//disable standard sort handler
				if (oEvent) {
					oEvent.preventDefault();
				}
				// Store the SortProperty & SortOrder for order fields to use in rowlevel = 1
				this.sSortOperationField = sColSortproperty;
				this.sOperationSortOrder = sColSortOrder;

				_oSorter = new sap.ui.model.Sorter(this.sSortOrderField, this.sOrderSortOrder === "Descending");
				_aSorterColumns = [_oSorter];
				//update column sort property
				this.updateColumnSortStatus(sColumnBinding, sColSortOrder);
				oBinding.sort(_aSorterColumns);

			} else {
				// Store the SortProperty & SortOrder for order fields to use in rowlevel = 0
				this.sSortOrderField = sColSortproperty;
				this.sOrderSortOrder = sColSortOrder;

				//Special case - if Sort field is MaintenanceOrder, then 
				//For operations we should use MaintenanceOperation
				if (sColSortproperty === "MaintenanceOrder") {
					this.sSortOperationField = "MaintenanceOrderOperation";
					this.sOperationSortOrder = sColSortOrder;
				}

				//Special case - common field Processing Status
				//if Sort field is ProcessingStatus, we need to apply it for both levels
				if (sColSortproperty === "ProcessingStatus") {
					this.sSortOperationField = this.sSortOrderField = sColSortproperty;
					this.sOperationSortOrder = this.sOrderSortOrder = sColSortOrder;
				}

				if (sColSortproperty === "FunctionalLocationName") {
					this.sSortOperationField = "OpFunctionalLocationName";
					this.sSortOrderField = sColSortproperty;
					this.sOperationSortOrder = this.sOrderSortOrder = sColSortOrder;
				}

				if (sColSortproperty === "EquipmentName") {
					this.sSortOperationField = "OperationEquipmentName";
					this.sSortOrderField = sColSortproperty;
					this.sOperationSortOrder = this.sOrderSortOrder = sColSortOrder;
				}

				if (sColSortproperty === "TechnicalObjectDescription") {
					this.sSortOperationField = "OperationTechnicalObjectDesc";
					this.sSortOrderField = sColSortproperty;
					this.sOperationSortOrder = this.sOrderSortOrder = sColSortOrder;
				}

				if (sColSortproperty === "OrderSystemConditionText") {
					this.sSortOperationField = "OperationSystemConditionText";
					this.sSortOrderField = sColSortproperty;
					this.sOperationSortOrder = this.sOrderSortOrder = sColSortOrder;
				}

				//Special case - common field Work Center
				if (sColSortproperty === "MainWorkCenter") {
					this.sSortOperationField = "WorkCenter";
					this.sOperationSortOrder = sColSortOrder;
				}

				//Special case - common field Phase
				if (sColSortproperty === "MaintOrdProcessPhaseCode") {
					this.sSortOperationField = "MaintOrdOpProcessPhaseCode";
					this.sOperationSortOrder = sColSortOrder;
				}

				//Special case - common field Subphase
				if (sColSortproperty === "MaintOrdProcessSubPhaseCode") {
					this.sSortOperationField = "MaintOrdOpProcessSubPhaseCode";
					this.sOperationSortOrder = sColSortOrder;
				}
			}
			var bCalledDuringInitialization = false;
			// we need to ensure $select for order request is set in sCustomParams before the next request is done
			if (oBinding.sCustomParams !== this._sSelectString) {
				this.setFinalSelectForOrderRequest(bCalledDuringInitialization);
			}

			if (oSortColumn) {
				_oSorter = new sap.ui.model.Sorter(this.sSortOrderField, this.sOrderSortOrder === "Descending");

				_aSorterColumns = [_oSorter];

				//update column sort property
				this.updateColumnSortStatus(sColumnBinding, sColSortOrder);

				oBinding.sort(_aSorterColumns);
			}

			//Clear the performance filter after sort as the filter string is reset.
			this._sPerformanceFilterOnExpand = null;
		},

		/**
		 * This takes care of updating the correct icon on the columns since the
		 * default sort handler is disabled when sorting with operation fields
		 * @private
		 * @param {sap.ui.table.Column} [sortedColumn] The column that is currently being sorted
		 * @param {sap.ui.table.SortOrder} [sortOrder] The order in which the column is being sorted
		 */
		updateColumnSortStatus: function (sortedColumn, sortOrder) {

			var aColumns = this.getView().byId("idOrderTreeTable").getColumns();
			aColumns.forEach(function (col) {
				if (col.getSorted) {
					col.setSorted(false);
					col._updateIcons();
				}
			});
			sortedColumn.setSorted(true);
			sortedColumn.setSortOrder(sortOrder);
			sortedColumn._updateIcons();
		},

		expandSelected: function (oEvent) {
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var selectedRows = oTreeTable.getSelectedIndices();

			var aMaintenanceOrderIDs = [];
			var aSelectedRowsBindingContext = this._getSelectedRowBindingContext(oTreeTable);
			for (var i = 0; i < aSelectedRowsBindingContext.length; i++) {
				aMaintenanceOrderIDs.push(aSelectedRowsBindingContext[i].getProperty().MaintenanceOrder);
			}
			this._addPerformanceFilterOnExpand(aMaintenanceOrderIDs);
			oTreeTable.expand(selectedRows);
		},

		collapseSelected: function (oEvent) {
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var selectedRows = oTreeTable.getSelectedIndices();
			oTreeTable.collapse(selectedRows);
		},

		/** 
		 * Called when treetable column is selected.
		 * @param {Object} [oEvent] Event Object
		 */
		onColumnSelect: function (oEvent) {
			var oColumn = oEvent.getParameters().column;
			var oColumnMenu = oColumn.getMenu();
			oColumnMenu.attachItemSelect(oColumnMenu, this._onItemInColumnMenuSelected, this);
		},

		_onItemInColumnMenuSelected: function (oEvent, oColumnMenu) {
			var sColumnNameToBeAdded = oEvent.getParameters().item.getText();
			var sColumnTechnicalNameToBeAdded;
			var sSelectedIcon = oEvent.getParameters().item.getIcon();
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var aAllColumns = oTreeTable.getColumns();

			//continue only if the icon is empty (because sort asc and sort dsc in the menu have icons)
			//and if no "Columns" 3rd option in main menu is selected
			if (!sSelectedIcon && !oEvent.getParameters().item.getSubmenu()) {
				//determine technical name based on thext name
				for (var i = 0; i < aAllColumns.length; i++) {
					if (aAllColumns[i].getLabel().getText() === sColumnNameToBeAdded && aAllColumns[i].getVisible()) {
						sColumnTechnicalNameToBeAdded = aAllColumns[i].getSortProperty();
						break;
					}
				}
				var bCalledDuringInitialization = false;
				this.setFinalSelectForOrderRequest(bCalledDuringInitialization, sColumnTechnicalNameToBeAdded);
				//ensure after full refresh is done, a message tast is shown setting this variable to true
				//onAfterActionCompleted will use it once request is completed
				this._bNewColumnAdded = true;
				//clear the performance filter on adding a column as all rows will be collapsed
				this._sPerformanceFilterOnExpand = null;
				this._refreshBinding(true);

			}
		},

		/**
		 * Called when treetable column is selected for visibility change
		 * @private
		 * @param {Object} [oEvent] Event object returning the selected column
		 */
		onColumnVisibilityChanged: function (oEvent) {
			var oSelectedColumn = oEvent.getParameters().column;
			//check if the selected column is the first (index 0)
			if (oSelectedColumn.getIndex() === 0) {
				//if its the first column, prevent default event handling
				oEvent.preventDefault();
				//show a message box of type warning to user that this column cannot be hidden
				Utils.addMessage(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("CannotHideOrderColumn"),
					sap.ui.core.MessageType.Warning, Constants.sDisplayTypeMessageBox);
			} else if (oSelectedColumn.getVisible() && oSelectedColumn.getSorted()) {
				//if visibility is changing to hidden then remove sorting assosciated with the column (if it is sorted) before hiding it
				oSelectedColumn.setSorted(false);
				var oBinding = this.getView().byId("idOrderTreeTable").getBinding();
				oBinding.aSorters = [];
				//To be on the safe side in addtion to clear the sorter also the storage for the fields is set back to initial values (MaintenanceOrder, MaintenanceOrderOperation)
				this.initSortOrderAndSortOperationFields();
			}
		},

		handleLinkPress: function (oEvent) {
			// decide whether to show the order or operation popup depending on what was clicked
			var rowLevel = oEvent.getSource().getBindingContext().getProperty("OrderOperationRowLevel");

			// Display Order Poup
			if (rowLevel === 0) {
				this._oOrderPopupDelegate = new OrderPopup();
				this.getView().getModel().setUseBatch(true);
				sap.ui.getCore().getMessageManager().registerObject(this._oOrderPopupDelegate.getFragment(), true);
				//  App state fields can be empty in case all columns are hidden except Maintenance Order column
				if (this._sOrderAppStateFields) {
					this._oOrderPopupDelegate.setContentToFragment(oEvent, this._oOwnerComponent, this._oOwnerComponent.getModel("readModel"), this._sOrderAllTechMandatoryFields +

						"," + this._sOrderAppStateFields +
						"," + this._sOrderAdditionalPopOverFields +
						"," + this._aExpandFields.toString());
				} else {
					this._oOrderPopupDelegate.setContentToFragment(oEvent, this._oOwnerComponent, this._oOwnerComponent.getModel("readModel"), this._sOrderAllTechMandatoryFields +
						"," + this._sOrderAdditionalPopOverFields +
						"," + this._aExpandFields.toString());
				}

				// Display Operation Popup 
			} else {
				this._oOperationPopupDelegate = new OperationPopup();
				this.getView().getModel().setUseBatch(true);
				sap.ui.getCore().getMessageManager().registerObject(this._oOperationPopupDelegate.getFragment(), true);
				this._oOperationPopupDelegate.setContentToFragment(oEvent, this._oOwnerComponent, this._oOwnerComponent.getModel("readModel"));
			}
		},

		/*
		 * @public
		 * Handler for the link press in Gantt rows which opens Functional Location popover
		 * @param {string} [oEvent] Event bus parameter
		 * @param {boolean} [bTechnicalObject] Navigation from technical object
		 */
		handleFuncLocLinkPress: function (oEvent, bTechnicalObject) {
			this._oInnerAppState = {
				customData: this._getCurrentAppState()
			};
			this._oFunctionalLocationPopupDelegate = new FunctionalLocationPopup();
			this.getView().getModel().setUseBatch(true);
			sap.ui.getCore().getMessageManager().registerObject(this._oFunctionalLocationPopupDelegate.getFragment(), true);
			this._oFunctionalLocationPopupDelegate.setContentToFragment(oEvent, this._oOwnerComponent, this._oOwnerComponent.getModel(
				"readModel"), this._oInnerAppState, bTechnicalObject);
		},

		/*
		 * @public
		 * Handler for the link press in Gantt rows which opens Equipment popover
		 * @param {string} [oEvent] Event bus parameter
		 * @param {boolean} [bTechnicalObject] Navigation from technical object
		 */
		handleEquipmentLinkPress: function (oEvent, bTechnicalObject) {
			this._oInnerAppState = {
				customData: this._getCurrentAppState()
			};
			this._oEquipmentPopupDelegate = new EquipmentPopup();
			this.getView().getModel().setUseBatch(true);
			sap.ui.getCore().getMessageManager().registerObject(this._oEquipmentPopupDelegate.getFragment(), true);
			this._oEquipmentPopupDelegate.setContentToFragment(oEvent, this._oOwnerComponent, this._oOwnerComponent.getModel(
				"readModel"), this._oInnerAppState, bTechnicalObject);
		},

		/*
		 * @public
		 * Handler for the link press in order and operations table rows which opens Technical object popover
		 * @param {string} [oEvent] Event bus parameter
		 */
		handleTechnicalObjectLinkPress: function (oEvent) {
			var sTechnicalObjectType = oEvent.getSource().getBindingContext().getProperty("TechObjIsEquipOrFuncnlLoc");
			var bTechnicalObject = true;
			if (sTechnicalObjectType === "EAMS_EQUI") {
				this.handleEquipmentLinkPress(oEvent, bTechnicalObject);
			} else {
				this.handleFuncLocLinkPress(oEvent, bTechnicalObject);
			}
		},

		/**
		 * Convenience method for triggering the workcenter settings popup
		 * @public
		 */
		openFilter: function () {

			this._oDelegate = new AssignMyWorkCenters();
			var oResourceModel = this.getView().getModel("i18n");
			this._oDelegate.getFragment().setModel(oResourceModel, "i18n");
			this.getView().getModel().setUseBatch(true);
			sap.ui.getCore().getMessageManager().registerObject(this._oDelegate.getFragment(), true);
			this._oDelegate.getFragment().setModel(this.getView().getModel());
			this.getView().getModel().setRefreshAfterChange(false);
			this._oDelegate.getFragment().setContentWidth("41%");
			this._oDelegate.getFragment().setBusy(true);
			this._oDelegate.getFragment().open();
			if (this._oMessageHandlerResponseModel) {
				var oMsgHandlerRespModel = this._oMessageHandlerResponseModel;
				oMsgHandlerRespModel.setProperty("/bIsDialogOpen", true);
				this._oDelegate.getFragment().attachAfterClose(function () {
					oMsgHandlerRespModel.setProperty("/bIsDialogOpen", false);
				});
			}
		},

		/**
		 * Allow to enable/disable buttons based on selection
		 * @public
		 * @param {string} [oEvent]   Event   event bus parameter
		 */
		selectTableRows: function (oEvent) {
			var oTreeTable = this.getView().byId("idOrderTreeTable");

			//Remove old messages from changed rows
			var changedRowIndices = oEvent.getParameter("rowIndices");
			for (var i = 0; i < changedRowIndices.length; i++) {
				var sPath = decodeURIComponent(oTreeTable.getContextByIndex(changedRowIndices[i]).sPath);
				if (sPath) {
					var sTarget = sPath;
					if (sPath.substring(0, 1) === "/") {
						sTarget = sPath.substring(1);
					}
					// delete old messages from the target
					var aMessages = this._getMessagesFromTarget(sTarget);
					sap.ui.getCore().getMessageManager().removeMessages(aMessages);
				}
			}

			this.updateToolbarButtonsFromSelectedRows();
		},

		/** 
		 * Enables/Disables Toolbar Buttons as per the row selections
		 * @public
		 */
		updateToolbarButtonsFromSelectedRows: function () {
			var oDispatchButton = this.getView().byId("idButtonDispatch");
			var oCancelDispatchButton = this.getView().byId("idButtonCancDispatch");
			var oChangeOperationsButton = this.getView().byId("idButtonChange");
			var oRemoveConstraintsButton = this.getView().byId("idRemoveConstraints");
			var oScheduleOrderButton = this.getView().byId("idScheduleOrder");
			var oTreeTable = this.getView().byId("idOrderTreeTable");

			//Disable all buttons and leave if no Row is selected
			var selectedRowIndices = oTreeTable.getSelectedIndices();
			if (!selectedRowIndices || selectedRowIndices.length === 0 || selectedRowIndices[0].length === 0) {
				//On deselection set all buttons to disabled again
				oDispatchButton.setEnabled(false);
				oCancelDispatchButton.setEnabled(false);
				oChangeOperationsButton.setEnabled(false);
				oRemoveConstraintsButton.setEnabled(false);
				oScheduleOrderButton.setEnabled(false);
				return;
			}

			var aSelectedItemsContext = this._getSelectedRowBindingContext(oTreeTable);
			var bAtLeastOneItemHasConstraints = false;
			var bAtLeastOneHeaderRowSelected = false;
			var bAtLeastOneItemDispatched = false;
			var bAtLeastoneOperationChangeable = false;
			var bAtLeastOneItemDue = false;

			for (var i = 0; i < aSelectedItemsContext.length; i++) {
				var itemModel = aSelectedItemsContext[i].getObject();

				//Order Header Row
				if (itemModel.OrderOperationRowLevel === 0) {
					bAtLeastOneHeaderRowSelected = true;
				} else if (Utils.checkIfOperationIsWithinTimePeriod(itemModel, this.oPeriodTypeDates)) {
					continue;
				} else {
					if (itemModel.HasError) {
						//function to get the messages for the MessagePopover 
						this.operationValidation(itemModel);
					} else {
						bAtLeastoneOperationChangeable = true;
						switch (itemModel.ProcessingStatus) {
						case Constants.dispatchedStatusCode:
							bAtLeastOneItemDispatched = true;
							break;
						case Constants.dueStatusCode:
							bAtLeastOneItemDue = true;
							break;
						}
						if (itemModel.OpBscStartDateConstraintType && itemModel.OrderOperationStartDateTime) {
							bAtLeastOneItemHasConstraints = true;
						}
					}
				}
			}

			//If only header row is selected then disable all buttons..
			if (bAtLeastOneHeaderRowSelected && !bAtLeastoneOperationChangeable) {
				oDispatchButton.setEnabled(false);
				oCancelDispatchButton.setEnabled(false);
				oChangeOperationsButton.setEnabled(false);
				oRemoveConstraintsButton.setEnabled(false);
				oScheduleOrderButton.setEnabled(true);
			} else {
				//Enabled/Disable the buttons individually based on the variable values
				oChangeOperationsButton.setEnabled(bAtLeastoneOperationChangeable);
				oCancelDispatchButton.setEnabled(bAtLeastOneItemDispatched);
				oDispatchButton.setEnabled(bAtLeastOneItemDue);
				oRemoveConstraintsButton.setEnabled(bAtLeastOneItemHasConstraints);
				oScheduleOrderButton.setEnabled(bAtLeastOneHeaderRowSelected);
			}
		},

		_getMessagesFromTarget: function (sTarget) {

			var aMessages = sap.ui.getCore().getMessageManager().getMessageModel().getProperty("/");
			var aMessagesFromTarget = [];

			aMessages.forEach(function (oMessage) {
				if (oMessage.target === sTarget) {
					aMessagesFromTarget.push(oMessage);
				}
			});

			return aMessagesFromTarget;
		},

		/**
		 * Function to generate the messages for the MessagePopover in UI	
		 * @public
		 * @param {Object} [oItemModel] item model bound to Operations entity
		 */
		operationValidation: function (oItemModel) {

			var hasError = oItemModel.HasError;
			var statusCode = oItemModel.ProcessingStatus;
			var maintenanceOrderValue = oItemModel.MaintenanceOrder;
			var maintenanceOrderOP = oItemModel.MaintenanceOrderOperation;
			var maintenanceOrderSubOP = oItemModel.MaintenanceOrderSubOperation;
			var sTarget = "C_RSHOrdersAndOperations" + "(" + "'" + oItemModel.ID + "'" + ")";

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

			if (hasError && statusCode === Constants.inProcessCode) {
				// Add a new message in the message popover
				//To avoid / and empty suboperatioin ID differenciate here whether the sub operation ID is empty or not
				if (maintenanceOrderSubOP) {
					Utils.addMessage(oResourceBundle.getText("ErrorMessageInProcessStatusSubOper", [maintenanceOrderValue, maintenanceOrderOP,
						maintenanceOrderSubOP
					]), sap.ui.core.MessageType.Information, Constants.sDisplayTypeMessagePopover, sTarget, true);
				} else {
					Utils.addMessage(oResourceBundle.getText("ErrorMessageInProcessStatusOper", [maintenanceOrderValue, maintenanceOrderOP, null]),
						sap.ui.core.MessageType.Information, Constants.sDisplayTypeMessagePopover, sTarget, true);
				}
			}
		},

		/*
		 * Clicked the Trigger Order Scheduling Button Id - idScheduleOrder
		 Schedules the selected order using RSH_SB_MAINTENANCE_ORDER
		 * @public
		*/
		pressScheduleOrderButton: function () {
			//Event Bus to be subscribed only once to handle it at u-shell level
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.subscribeOnce(Constants.sLibraryChannel, Constants.sServerMessageToUpdateEntity, this.prepareTargetForRefreshGantt,
				this);
			var oGanttChartContainer = this.getView().byId("idOrderGanttContainer");
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var aSelectedItemsContext = this._getSelectedRowBindingContext(oTreeTable);
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			var bOneHeaderRowSelected = false;
			var oItemModelForSelectedOrder;

			//If more than 1 order is selected, we give error message saying only one 
			//is to be selected.
			for (var i = 0; i < aSelectedItemsContext.length; i++) {
				var itemModel = aSelectedItemsContext[i].getObject();

				//Order Header Row
				if (itemModel.OrderOperationRowLevel === 0) {
					if (bOneHeaderRowSelected === true) {
						Utils.addMessage(oResourceBundle.getText("SelectOnlyOneOrder"), sap.ui.core.MessageType.Error, Constants.sDisplayTypeMessageBox);
						return;
					} else {
						bOneHeaderRowSelected = true;
						oItemModelForSelectedOrder = itemModel;
					}
				}
			}

			//If the selected item is anything other than header row or already dispatched item then move to next item..
			if (oItemModelForSelectedOrder.OrderOperationRowLevel !== 0 || oItemModelForSelectedOrder.ProcessingStatus === Constants.inProcessCode) {
				Utils.addMessage(oResourceBundle.getText("InProcessOrderSch"), sap.ui.core.MessageType.Error, Constants.sDisplayTypeMessageBox);
				return;
			}

			//Set busy indicator
			oGanttChartContainer.setBusy(true);

			// Call the schedule service binding from backend
			var functionCallName = "/ScheduleMaintenanceOrder";
			var oRelationModel = this.getView().getModel("relationshipModel");
			var parameters = {
				MaintenanceOrder: oItemModelForSelectedOrder.MaintenanceOrder
			};

			var that = this;
			oRelationModel.callFunction(functionCallName, {
				method: "POST",
				urlParameters: parameters,
				success: function (oData) {
					that.onScheduleSuccess(oItemModelForSelectedOrder);
				},
				error: function (oData) {
					that.onScheduleFailed(oItemModelForSelectedOrder);
				}
			});
		},

		/*
		 *When Trigger Order Scheduling is successful
		 * @public
		 * @param {Object} [oData] Current data 
		 */
		onScheduleSuccess: function (oData) {
			var oTargetParams = {};
			oTargetParams.itemHashMapContainer = [];
			oTargetParams.itemHashMapContainer.push(oData.MaintenanceOrder);
			oTargetParams.parameters = {};
			oTargetParams.parameters.bRefreshOfSourceAppRequired = true;

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

			Utils.addMessage(oResourceBundle.getText("ScheduleSuccess"), sap.ui.core.MessageType.Success, Constants.sDisplayTypeMessageToast);
			//Trigger delta refresh query
			this.prepareTargetForRefreshGantt("", "", oTargetParams);
			this.getView().byId("idOrderGanttContainer").setBusy(false);
		},

		/*
		 *When Trigger Order Scheduling is not successful.
		 * @public
		 * @param {Object} [oError] Error details
		 */
		onScheduleFailed: function (oError) {

			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

			Utils.addMessage(oResourceBundle.getText("ScheduleError"), sap.ui.core.MessageType.Error, Constants.sDisplayTypeMessagePopover);
			this.getView().byId("idOrderGanttContainer").setBusy(false);

		},

		/**
		 * Clicked the Dispatch button
		 * @public
		 */
		pressDispatchButton: function (oEvent) {
			//Event Bus to be subscribed only once to handle it at u-shell level
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.subscribeOnce(Constants.sLibraryChannel, Constants.sServerMessageToUpdateEntity, this.prepareTargetForRefreshGantt,
				this);
			var oGanttChartContainer = this.getView().byId("idOrderGanttContainer");
			var viewModel = this.getView().getModel();
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			//var aSelectedRows = this._getSelectionRows(oTreeTable);
			var aSelectedItemsContext = this._getSelectedRowBindingContext(oTreeTable);
			//Set busy indicator
			oGanttChartContainer.setBusy(true);
			var itemModel = null;

			//this is special flag can be set in mass change dialog only
			//hense pass false for dispatch button logic 
			var bTriggerStatusChangeIrrespectiveOfCurrentStatus = false;

			if (oEvent.getSource().getId().includes("idButtonDispatchAction")) {
				this._bActionInitiatedFromContextMenu = true;
				//In case triggered from Shape Context Menu
				var sOpShapePath = this._oShapeForOpContextMenu.getBindingContext().getPath();
				var oOperationData = this.getModel().getData(sOpShapePath);
				itemModel = oOperationData;
				//Proceed only if no error or has cross order releation for the current operation
				if (!itemModel.HasError) {
					// delete old messages from the target
					sap.ui.getCore().getMessageManager().removeAllMessages();
					// Prepare the backend call to set dispatch status
					this.statusCommon.setOperationDispatchStatus(itemModel, viewModel, bTriggerStatusChangeIrrespectiveOfCurrentStatus);

				} else {
					//function to get a message for the MessagePopover
					this.operationValidation(itemModel);

				}
			} else {
				//if triggered from toolbar button
				for (var i = 0; i < aSelectedItemsContext.length; i++) {
					itemModel = aSelectedItemsContext[i].getObject();

					//If the selected item is header row or already dispatched item then move to next item..
					if (itemModel.OrderOperationRowLevel === 0 || itemModel.ProcessingStatus === Constants.dispatchedStatusCode) {
						continue;
					}
					if (Utils.checkIfOperationIsWithinTimePeriod(itemModel, this.oPeriodTypeDates)) {
						continue;
					}
					//Proceed only if no error or has cross order releation for the current operation
					if (!itemModel.HasError) {
						// delete old messages from the target
						sap.ui.getCore().getMessageManager().removeAllMessages();
						// Prepare the backend call to set dispatch status
						this.statusCommon.setOperationDispatchStatus(itemModel, viewModel, bTriggerStatusChangeIrrespectiveOfCurrentStatus);

					} else {
						//function to get a message for the MessagePopover
						this.operationValidation(itemModel);

					}
				}
			}
			// Finally perfom the backend call
			this.statusCommon.triggerBackendCall();
		},

		/**
		 * Clicked the Cancel Dispatch button
		 * @public
		 */
		pressCancDispatchButton: function (oEvent) {
			//Event Bus to be subscribed only once to handle it at u-shell level
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.subscribeOnce(Constants.sLibraryChannel, Constants.sServerMessageToUpdateEntity, this.prepareTargetForRefreshGantt,
				this);
			var viewModel = this.getView().getModel();
			var oGanttChartContainer = this.getView().byId("idOrderGanttContainer");
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			//var aSelectedRows = this._getSelectionRows(oTreeTable);
			var aSelectedItemsContext = this._getSelectedRowBindingContext(oTreeTable);
			//Set busy indicator
			oGanttChartContainer.setBusy(true);
			var itemModel = null;

			//this is special flag can be set in mass change dialog only
			//hense pass false for dispatch button logic
			var bTriggerStatusChangeIrrespectiveOfCurrentStatus = false;
			if (oEvent.getSource().getId().includes("idButtonCancDispatchAction")) {
				this._bActionInitiatedFromContextMenu = true;
				//In case triggered from Shape Context Menu
				var sOpShapePath = this._oShapeForOpContextMenu.getBindingContext().getPath();
				var oOperationData = this.getModel().getData(sOpShapePath);
				itemModel = oOperationData;
				//Proceed only if no error or has cross order releation for the current operation
				if (!itemModel.HasError) {
					// delete old messages from the target
					sap.ui.getCore().getMessageManager().removeAllMessages();
					// Prepare the backend call to set dispatch status
					this.statusCommon.cancelOperationDispatchStatus(itemModel, viewModel, bTriggerStatusChangeIrrespectiveOfCurrentStatus);
				} else {
					//function to get a message for the MessagePopover
					this.operationValidation(itemModel);
				}
			} else {
				//if triggered from toolbar button
				for (var i = 0; i < aSelectedItemsContext.length; i++) {
					itemModel = aSelectedItemsContext[i].getObject();

					//If the selected item is header row or already due item then move to next item..
					if (itemModel.OrderOperationRowLevel === 0 || itemModel.ProcessingStatus === Constants.dueStatusCode) {
						continue;
					}
					if (Utils.checkIfOperationIsWithinTimePeriod(itemModel, this.oPeriodTypeDates)) {
						continue;
					}
					//Proceed only if no error or has cross order relation for the current operation
					if (!itemModel.HasError) {
						// delete old messages from the target
						sap.ui.getCore().getMessageManager().removeAllMessages();
						//Prepare the backend call to set dispatch status
						this.statusCommon.cancelOperationDispatchStatus(itemModel, viewModel, bTriggerStatusChangeIrrespectiveOfCurrentStatus);
					} else {
						//create a message for the Message Popover
						this.operationValidation(itemModel);
					}
				}
			}
			// Finally perfom the backend call
			this.statusCommon.triggerBackendCall();
		},

		/** 
		 * Clicked the Change Operations button
		 * @param {object} oEvent Event object returning pressed button
		 */
		pressChangeOperationsButton: function (oEvent) {
			//Event Bus to be subscribed only once to handle it at u-shell level
			var oEventBus = sap.ui.getCore().getEventBus();
			if (oEvent.getSource().getId().includes("idButtonChangeAction")) {
				this._bActionInitiatedFromContextMenu = true;
			}
			oEventBus.subscribeOnce(Constants.sLibraryChannel, Constants.sServerMessageToUpdateEntity, this.prepareTargetForRefreshGantt,
				this);
			this._oChangeOperationsDelegate = new ChangeOperations();
			this.getView().getModel().setUseBatch(true);
			sap.ui.getCore().getMessageManager().registerObject(this._oChangeOperationsDelegate.getFragment(), true);

			this._oChangeOperationsDelegate.setContentToFragment(oEvent, this._oOwnerComponent, this.getView(), this.statusCommon, this.oPeriodTypeDates,
				this._oShapeForOpContextMenu);

		},

		/** Clicked the "Remove Constraints" button
		 * @public
		 */
		pressRemoveConstraintsButton: function (oEvent) {
			//Event Bus to be subscribed only once to handle it at u-shell level
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.subscribeOnce(Constants.sLibraryChannel, Constants.sServerMessageToUpdateEntity, this.prepareTargetForRefreshGantt,
				this);
			var viewModel = this.getView().getModel();
			var oGanttChartContainer = this.getView().byId("idOrderGanttContainer");
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var aSelectedItemsContext = this._getSelectedRowBindingContext(oTreeTable);
			//Set busy indicator
			oGanttChartContainer.setBusy(true);
			var itemModel = null;
			if (oEvent.getSource().getId().includes("idButtonRemoveConstraintsAction")) {
				this._bActionInitiatedFromContextMenu = true;
				//In case triggered from Shape Context Menu
				var sOpShapePath = this._oShapeForOpContextMenu.getBindingContext().getPath();
				var oOperationData = this.getModel().getData(sOpShapePath);
				itemModel = oOperationData;
				//Proceed only if no error or has cross order releation for the current operation
				if (!itemModel.HasError) {
					// delete old messages from the target
					sap.ui.getCore().getMessageManager().removeAllMessages();
					// Prepare the backend call to set dispatch status
					this.statusCommon.removeOperationConstraints(itemModel, viewModel);
				} else {
					//function to get a message for the MessagePopover
					this.operationValidation(itemModel);
				}
			} else {
				//if triggered from toolbar button
				for (var i = 0; i < aSelectedItemsContext.length; i++) {
					itemModel = aSelectedItemsContext[i].getObject();
					if (Utils.checkIfOperationIsWithinTimePeriod(itemModel, this.oPeriodTypeDates)) {
						continue;
					}
					//Proceed only if no error for the current operation
					if (!itemModel.HasError) {
						// delete old messages from the target
						sap.ui.getCore().getMessageManager().removeAllMessages();
						//Prepare the backend call to remove the Operation constraints
						this.statusCommon.removeOperationConstraints(itemModel, viewModel);
					} else {
						//create a message for the Message Popover
						this.operationValidation(itemModel);
					}
				}
			}
			// Finally perfom the backend call
			this.statusCommon.triggerBackendCall();
		},

		// _getSelectionRows: function (oTreeTable) {
		// 	var aSelectedRows = [];
		// 	var selectedRowIndices = oTreeTable.getSelectedIndices();
		// 	var tableRowsArray = oTreeTable.getRows();
		// 	for (var i = 0; i < selectedRowIndices.length; i++) {
		// 		if (tableRowsArray[selectedRowIndices[i]]) {
		// 			aSelectedRows.push(tableRowsArray[selectedRowIndices[i]]);
		// 		}
		// 	}
		// 	return aSelectedRows;
		// },
		_getSelectedRowBindingContext: function (oTreeTable) {
			var aSelectedRowBindingContexts = [];
			var selectedRowIndices = oTreeTable.getSelectedIndices();
			var aRowBindings = oTreeTable.getBinding("rows");
			for (var i = 0; i < selectedRowIndices.length; i++) {
				if (aRowBindings.getContextByIndex(selectedRowIndices[i])) {
					aSelectedRowBindingContexts.push(aRowBindings.getContextByIndex(selectedRowIndices[i]));
				}
			}
			return aSelectedRowBindingContexts;
		},

		_requestSent: function (oEvent) {
			this.requestProcessingHandler(this.onBeforeRequestCompleted,
				this.getView().byId("idOrderGanttContainer"),
				oEvent);
		},

		_requestComplete: function (oEvent) {
			//added for scenerios when workcenter is added or removed for the user while the sorting is already applied
			if (oEvent.getParameter("requests")) {
				var oRequest = oEvent.getParameter("requests")[0];
				if (oRequest.url.indexOf("C_RSHEAMUserVariant") !== -1 && oRequest.method !== "GET") {
					//reset the sorting for the table to the .
					var oTreeTable = this.getView().byId("idOrderTreeTable");
					var binding = oTreeTable.getBinding("rows");
					//added to handle cases where sorter is not set
					if (binding.aSorters.length !== 0) {
						binding.aSorters[0].sPath = this.sSortOrderField;
						binding.aSorters[0].bDescending = this.sOrderSortOrder === "Descending";
					}
					//in case a ned column in Gantt was added and a full Gantt refresh is triggered, 
					//display a message toast once the refresh is completed					
				} else if (oRequest.url.indexOf("C_RSHOrdersAndOperations") !== -1 && oRequest.method === "GET") {
					var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
					if (this._bNewColumnAdded) {
						Utils.addMessage(oResourceBundle.getText("FullRefreshAfterColumnAdded"), sap.ui.core.MessageType.Information, Constants.sDisplayTypeMessageToast);
						this._bNewColumnAdded = false;
					}
				}
			}
			//Check if an operation change action was completed, if yes then keep the screen busy
			if (oEvent.getParameter("requests") && (oRequest.url.indexOf("I_MaintOrderOperationTP") === -1 && oRequest.method !== "POST")) {
				this.requestProcessingHandler(this.onAfterRequestCompleted,
					this.getView().byId("idOrderGanttContainer"), oEvent);
				//Close the mass change dialog after the data is received
				if (this.onAfterDataRecievedFn) {
					this.onAfterDataRecievedFn();
					this.onAfterDataRecievedFn = null;
				}
			}

		},

		onBeforeRequestCompleted: function (oGanttControl) {

			// we need to suppress the busy indicator for the default 2nd call 
			// which is done to prefetch the next page by the framework
			// Here a dummy property bSkipBusyIndicator is used 
			// State 1 - Undefined - show busy indicator
			// State 2 - True - skip busy indicator (since it is prefetch of additional rows and UI is already usable)
			// State 3 - False - here after we update busy indicator always
			//if (!oGanttControl._bSkipBusyIndicator) {
			oGanttControl.setBusy(true);
			//}

			/*	if (typeof oGanttControl._bSkipBusyIndicator === "undefined") {
					oGanttControl._bSkipBusyIndicator = true;
				} else {
					oGanttControl._bSkipBusyIndicator = false;
				}*/

		},

		onAfterRequestCompleted: function (oGanttControl) {
			oGanttControl.setBusy(false);
			// This line was added because after the Gantt control is loaded the tree control
			// says 'no data' unless a column is resized, so force rerender after data bind.
			// This is a workaround for the above ipro,ssue.
			// Correction progress to be followed in the Internal Incident: 1770468435. 
			/*jQuery.sap.delayedCall(0, this, function () {
				// oGanttControl.rerender();
			});
*/
		},

		requestProcessingHandler: function (fHandler, oGanttContainer, oEvent) {

			if (oGanttContainer) {

				var aRequest = oEvent.getParameter("requests");
				var bPerformHandler = false;

				for (var i = 0; aRequest && i < aRequest.length; i++) {

					bPerformHandler = aRequest[i].url.indexOf("C_RSHOrdersAndOperations") !== -1;

					if (bPerformHandler) {
						fHandler(oGanttContainer);
						return;
					}
				}
			}
		},

		_onAfterActionsCompleted: function (oRefreshParametersOfSourceApp) {
			if (oRefreshParametersOfSourceApp && oRefreshParametersOfSourceApp.bRefreshOfSourceAppRequired) {
				if (this._bActionInitiatedFromContextMenu) {
					this.onAfterDataRecievedFn = oRefreshParametersOfSourceApp.onAfterTableBindFn;
				} else {
					this.disableButtons();
					this.getView().byId("idOrderTreeTable").getBinding("rows").clearSelection();
					//Store the function reference and invoke it once the subsequent read is done.
					this.onAfterDataRecievedFn = oRefreshParametersOfSourceApp.onAfterTableBindFn;
				}
			} else {
				//If the action resulted in no change then restore the application state
				this.getView().byId("idOrderGanttContainer").setBusy(false);
				if (oRefreshParametersOfSourceApp && oRefreshParametersOfSourceApp.onAfterTableBindFn) {
					oRefreshParametersOfSourceApp.onAfterTableBindFn();
				}
			}
		},

		/**
		 * disable Set/Cancel Dispatch buttons
		 * @public
		 */
		disableButtons: function () {
			var oDispatchButton = this.getView().byId("idButtonDispatch");
			var oCancelDispatchButton = this.getView().byId("idButtonCancDispatch");
			var oChangeOperationsButton = this.getView().byId("idButtonChange");
			var oScheduleOrderButton = this.getView().byId("idScheduleOrder");
			var oRemoveConstraintsButton = this.getView().byId("idRemoveConstraints");

			oDispatchButton.setEnabled(false);
			oCancelDispatchButton.setEnabled(false);
			oChangeOperationsButton.setEnabled(false);
			oScheduleOrderButton.setEnabled(false);
			oRemoveConstraintsButton.setEnabled(false);
		},

		/**
		 * Returns unique shape id for a relationship
		 * @param {String} [p] PredecessorOrderOperationRowID
		 * @param {String} [s] SuccessorOrderOperationRowID
		 * @param {String} [n] NetworkActivityRelationType
		 *  @returns {String} Concatenated shape id
		 * @public
		 */
		getShapeId: function (p, s, n) {
			return p + "" + s + "" + n;
		},

		getStrokeFill: function (sExplicit, sViolation) {
			if (sViolation === "X") {
				return "@sapNegativeColor";
			} else if (sExplicit === "X") {
				return "@sapTextColor"; //Fiori Black is not defined (but it is universal)
			} else {
				return "@sapNeutralColor";
			}
		},

		getRelationToolTip: function (sNetworkActivityRelationType, sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
			sSuccessorOrderOperation, sRelationshipIsViolated) {
			var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
			if (sRelationshipIsViolated === "X") {
				switch (sNetworkActivityRelationType) {
				case sap.gantt.simple.RelationshipType.StartToStart:
					return oResourceBundle.getText("violatedS2SRelTooltip", [sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
						sSuccessorOrderOperation
					]);
				case sap.gantt.simple.RelationshipType.StartToFinish:
					return oResourceBundle.getText("violatedS2FRelTooltip", [sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
						sSuccessorOrderOperation
					]);
				case sap.gantt.simple.RelationshipType.FinishToStart:
					return oResourceBundle.getText("violatedF2SRelTooltip", [sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
						sSuccessorOrderOperation
					]);
				case sap.gantt.simple.RelationshipType.FinishToFinish:
					return oResourceBundle.getText("violatedF2FRelTooltip", [sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
						sSuccessorOrderOperation
					]);
				default:
					return "";
				}
			} else {
				switch (sNetworkActivityRelationType) {
				case sap.gantt.simple.RelationshipType.StartToStart:
					return oResourceBundle.getText("normalS2SRelTooltip", [sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
						sSuccessorOrderOperation
					]);
				case sap.gantt.simple.RelationshipType.StartToFinish:
					return oResourceBundle.getText("normalS2FRelTooltip", [sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
						sSuccessorOrderOperation
					]);
				case sap.gantt.simple.RelationshipType.FinishToStart:
					return oResourceBundle.getText("normalF2SRelTooltip", [sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
						sSuccessorOrderOperation
					]);
				case sap.gantt.simple.RelationshipType.FinishToFinish:
					return oResourceBundle.getText("normalF2FRelTooltip", [sPredecessorOrder, sPredecessorOrderOperation, sSuccessorOrder,
						sSuccessorOrderOperation
					]);
				default:
					return "";
				}
			}
		},

		/** 
		 * Function to add Padding at start of a given string
		 * @private 
		 * @param {Integer} [iLength] The final length of the string
		 * @param {String} [sString] Giveb String
		 * @returns {String} Returns the padded string
		 */
		_addPaddingAtStart: function (iLength, sString) {
			if (sString.length === iLength) {
				return sString;
			} else {
				return this._addPaddingAtStart(iLength, "0" + sString);
			}
		},

		/** 
		 * Function to get the internal relationship type on drawing a relationship
		 * @private 
		 * @param {String} [sRelationshipType] descriptive text
		 * @returns {String} [sRelationshipType] Relationship type 
		 */
		_getInternalRelationshipType: function (sRelationshipType) {
			switch (sRelationshipType) {
			case "FinishToStart":
				return "NF";
			case "StartToStart":
				return "AF";
			case "FinishToFinish":
				return "EF";
			case "StartToFinish":
				return "SF";
			default:
				return " ";
			}
		},

		/**
		 * shapeConnect Event triggered on Connecting two shapes. Additionally, connectable needs to be enabled for the shape.
		 * Creates a new relationship using the service RSH_SB_MAINTENANCE_ORDER
		 * @public
		 * @param {Object} [oEvent] Event object
		 */
		createRelationship: function (oEvent) {
			var fnParseUid = sap.gantt.misc.Utility.parseUid;
			var oModel = this.getView().getModel();

			// Get the 'from' operation info
			var sfromNode = oEvent.getParameter("fromShapeUid");
			var oParsedUid = fnParseUid(sfromNode);
			var oFromRow = oModel.getObject(oParsedUid.shapeDataName);

			// Get the 'to' operation info
			var sToNode = oEvent.getParameter("toShapeUid");
			oParsedUid = fnParseUid(sToNode);
			var oToRow = oModel.getObject(oParsedUid.shapeDataName);

			// Get the relationship type
			var sRelationshipType = oEvent.getParameter("type");

			// Get the internal relationship type
			var sInternalRelationshipType = this._getInternalRelationshipType(sRelationshipType);

			var oPayload = {
				"MaintenanceOrder": oFromRow.MaintenanceOrder,
				"MaintenanceOrderOperation": oFromRow.MaintenanceOrderOperation,
				"MaintenanceOrderSubOperation": "",
				"MaintOrdOperationIsSuccessor": false,
				"RelatedMaintenanceOrder": oToRow.MaintenanceOrder,
				"RelatedMaintOrderOperation": oToRow.MaintenanceOrderOperation,
				"OrderOpRelationshipIntType": sInternalRelationshipType
			};

			var oRelationModel = this.getView().getModel("relationshipModel");
			var that = this;
			var oResourceBundle = that.getOwnerComponent().getModel("i18n").getResourceBundle();

			var oParametersForCreateEntry = {
				success: function (oData) {
					var oTargetParams = {};
					oTargetParams.itemHashMapContainer = [];
					oTargetParams.itemHashMapContainer.push(oFromRow.MaintenanceOrder);
					oTargetParams.itemHashMapContainer.push(oToRow.MaintenanceOrder);
					oTargetParams.parameters = {};
					oTargetParams.parameters.bRefreshOfSourceAppRequired = true;

					Utils.addMessage(oResourceBundle.getText("RelationshipCreationSuccess"), sap.ui.core.MessageType.Success, Constants.sDisplayTypeMessageToast);

					//Trigger delta refresh query
					that.prepareTargetForRefreshGantt("", "", oTargetParams);
				},
				error: function (oError) {
					that.getView().byId("idOrderGanttContainer").setBusy(false);
				}
			};

			this.getView().byId("idOrderGanttContainer").setBusy(true);
			oRelationModel.create("/C_RSHMaintenanceOrdOperationTP(MaintenanceOrder='" + this._addPaddingAtStart(12, oFromRow.MaintenanceOrder) +
				"',MaintenanceOrderOperation='" + oFromRow.MaintenanceOrderOperation +
				"',MaintenanceOrderSubOperation='" + encodeURIComponent(" ") + "')/to_MaintOrderOpRelationship", oPayload,
				oParametersForCreateEntry
			);

		},

		onFirstVisibleRowChanged: function (oEvent) {
			this._refreshBinding(false);
			//Need to reset $Select and performance filter for order request upon scrolling, ensure binding exists
			if (oEvent.getSource().getBinding("rows")) {
				if (this._sPerformanceFilterOnExpand) {
					oEvent.getSource().getBinding("rows").sFilterParams = this._sExistingFilterString;
					this._sPerformanceFilterOnExpand = null;
				}
				this.setFinalSelectForOrderRequest();
			}
			this._closeContextMenus();
		},

		/** 
		 * Triggerd by event visibleHorizonUpdate
		 */
		onVisibleHorizonUpdate: function () {
			//If visible gantt chart changes horizontally then close the context menu if open
			this._closeContextMenus();
		},

		_closeContextMenus: function () {
			if (this._oShapeContextMenu && this._oShapeContextMenu.isOpen()) {
				this._oShapeContextMenu.close();
			}
			if (this.oRelationshipActionSheet && this.oRelationshipActionSheet.isPopoverOpen()) {
				this.oRelationshipActionSheet.closePopover();
			}
		},

		/** 
		 * Handler for the change event of the custom settings dialog which is fired of a change of setting was recorded there
		 * It will reapply custom setting to the UIModel, update binding where needed and reapplies the standard gantt settings
		 * @param {string} sLibraryChannel - used event channel
		 * @param {string} sEvent - event name
		 * @param {object} oSettings - changed settings handed over from dialog
		 */
		_onGanttSettingDialogChange: function (sLibraryChannel, sEvent, oSettings) {
			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			var sPropertypath;

			//Save the changed custom setting to UIModel
			Object.keys(oSettings).forEach(function (settingName) {
				//Change UIModel for custom settings - standard gantt settings are not part of the UIModel
				//If Statement has to be kept in sync with the used standard settings of Gantt, whenerver one is added is needs to be added here as well
				if (settingName !== "enableNowLine" || settingName !== "enableCursorLine" || settingName !== "enableVerticalLine" || settingName !==
					"enableStatusBar") {
					sPropertypath = "/" + settingName;
					oUIModel.setProperty(sPropertypath, oSettings[settingName]);
				}
			});

			if (oUIModel.getProperty("/showUtilizationIndicator") || oUIModel.getProperty("/showNonWorkingTimes")) {
				this._setThresholdForModelData();
			}
			//Bind/send Relationship, Utilization and Non Working Time request if needed
			this.updateRelationshipsAndUtilizations();
			this.bindCalendarDefHelper();

			//condensed mode setting
			var bRerender = false;
			if (!(oSettings.condensedModeActive === undefined)) {
				this._activateCondensedMode(bRerender);
				bRerender = true;
			}
			//reapply all used standard settings at once if at least one of them has changed
			if (oSettings.enableNowLine !== undefined || oSettings.enableCursorLine !== undefined || oSettings.enableVerticalLine !==
				undefined || oSettings.enableStatusBar !== undefined) {
				var oGanttContainer = this.getView().byId("idOrderGanttContainer");
				var mSettings = {
					enableNowLine: oSettings.enableNowLine !== undefined ? oSettings.enableNowLine : oGanttContainer.getEnableNowLine(),
					enableCursorLine: oSettings.enableCursorLine !== undefined ? oSettings.enableCursorLine : oGanttContainer.getEnableCursorLine(),
					enableVerticalLine: oSettings.enableVerticalLine !== undefined ? oSettings.enableVerticalLine : oGanttContainer.getEnableVerticalLine(),
					enableStatusBar: oSettings.enableStatusBar !== undefined ? oSettings.enableStatusBar : oGanttContainer.getEnableStatusBar()
				};
				oGanttContainer.applySettings(mSettings);
				//applySettings function automatically rerenders the Gantt Table so no need to explicitly rerender afterwards
				bRerender = false;
			}
			if (bRerender) {
				this.getView().byId("idOrderGanttContainer").rerender();
			} else {
				//If the gantt is not rerendered subscribe to the custom event raised in change event of gantt to update the button states
				sap.ui.getCore().getEventBus().subscribeOnce(this.sOrderGanttChannel, this.sIndiviudalActionOnGanttChange, this.updateToolbarButtonsFromSelectedRows,
					this);
			}
			this.persistSettingsP13n();
		},

		/** 
		 * Handler for the press event of the custom setting button
		 * Opens the custom settings dialog
		 * @param {object} oEvent - event object
		 */
		onCustomGanttSettingPress: function (oEvent) {
			var oView = this.getView();
			var oEventBus = sap.ui.getCore().getEventBus();
			//SettingConfiguration defines which settings(Layouts and single controls) are displayed on the settings dialog
			var oSettingConfiguration = this.getOwnerComponent().getModel("GanttSettingConfiguration");
			var oSettingValues = this._getGanttSettingValues();

			var oGanttSettingDialog = new GanttChartSettingsDialog(oSettingConfiguration.getData(), oSettingValues, oView);
			//subsribe to the change event fired by the settings dialog if any change happend to the settings
			oEventBus.subscribeOnce(Constants.sLibraryChannel, Constants.sGanttSettingsChanged, this._onGanttSettingDialogChange,
				this);
			oGanttSettingDialog.openDialog();
		},

		/** 
		 * Build up JSON Object for the gantt settings this includes the used standard gantt settings (e.g NowLine)
		 * and the custom setting like Relationships, REstrictions and condensed mode which are also stored in UIModel to handle correct display
		 * @returns {JSON} oSettingValues
		 */
		_getGanttSettingValues: function () {
			var oSettingValues = {};
			var oGanttContainer = this.getView().byId("idOrderGanttContainer");
			var oUIModel = this._oOwnerComponent.getModel("UIModel");

			//Layout Tab
			oSettingValues.enableNowLine = oGanttContainer.getEnableNowLine();
			oSettingValues.enableCursorLine = oGanttContainer.getEnableCursorLine();
			oSettingValues.enableVerticalLine = oGanttContainer.getEnableVerticalLine();
			oSettingValues.enableStatusBar = oGanttContainer.getEnableStatusBar();
			oSettingValues.bCondensedModeActive = oUIModel.getProperty("/condensedModeActive");

			//WorkCenter Tab
			oSettingValues.bShowNonWorkingTimes = oUIModel.getProperty("/showNonWorkingTimes");
			oSettingValues.bShowUtilizationIndicator = oUIModel.getProperty("/showUtilizationIndicator");

			//OrderAndOperationTab
			oSettingValues.bShowFinalDueDate = oUIModel.getProperty("/showFinalDueDate");
			oSettingValues.bShowImpRel = oUIModel.getProperty("/showImpRel");
			oSettingValues.bShowExpRel = oUIModel.getProperty("/showExpRel");
			oSettingValues.bShowRestrictions = oUIModel.getProperty("/showRestrictions");

			return oSettingValues;
		},

		/** 
		 * activates condensed mode as per user setting and rerenders gantt based on parameter
		 * @param {boolean} bRerender - Needs to be set to true if an explicit rerender of the gantt is needed
		 * @private 
		 */
		_activateCondensedMode: function (bRerender) {
			var oUIModel = this._oOwnerComponent.getModel("UIModel");

			if (oUIModel.getProperty("/condensedModeActive")) {
				this.getView().addStyleClass(this.getOwnerComponent().getContentDensityAdditionalClass());
			} else {
				this.getView().removeStyleClass(this.getOwnerComponent().getContentDensityAdditionalClass());
			}
			if (bRerender) {
				this.getView().byId("idOrderGanttContainer").rerender();
			}
		},

		/**
		 * Function to bind and unbind Relationships and Utilizations based on settings change
		 * @public
		 */
		updateRelationshipsAndUtilizations: function () {
			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			var oGntRowStg = this.byId("OrderGntRowStgID");
			var oTreeTable = this.byId("idOrderTreeTable");

			if (!oUIModel.getProperty("/showImpRel") && !oUIModel.getProperty("/showExpRel")) {
				if (oGntRowStg.getBindingInfo("relationships")) {
					this._previousRelationshipBinding = oGntRowStg.getBindingInfo("relationships");
					oGntRowStg.unbindAggregation("relationships");
					oTreeTable.setRowSettingsTemplate(null);
					oTreeTable.setRowSettingsTemplate(oGntRowStg);
				}
			} else {
				if (!oGntRowStg.getBindingInfo("relationships")) {
					//Full refresh is required in scenarios when settings is switched on first time within the app
					//in order to add association to the tree table rows and subsequent expand requests
					var bCalledDuringInitialization = false;
					this._sPerformanceFilterOnExpand = null;
					this.setFinalSelectForOrderRequest(bCalledDuringInitialization);
					oTreeTable.getBinding("rows").refresh();
					oGntRowStg.bindAggregation("relationships", this._previousRelationshipBinding);
					oTreeTable.setRowSettingsTemplate(null);
					oTreeTable.setRowSettingsTemplate(oGntRowStg);
				}
			}
			if (!oUIModel.getProperty("/showUtilizationIndicator")) {
				if (oGntRowStg.getBindingInfo("shapes4")) {
					this._previousUtilizationBinding = oGntRowStg.getBindingInfo("shapes4");
					oGntRowStg.unbindAggregation("shapes4");
					oTreeTable.setRowSettingsTemplate(null);
					oTreeTable.setRowSettingsTemplate(oGntRowStg);
				}
			} else {
				if (!oGntRowStg.getBindingInfo("shapes4")) {
					//Full refresh is required in scenarios when settings is switched on first time within the app
					//in order to add association to the tree table rows and subsequent expand requests
					bCalledDuringInitialization = false;
					this._sPerformanceFilterOnExpand = null;
					this.setFinalSelectForOrderRequest(bCalledDuringInitialization);
					oTreeTable.getBinding("rows").refresh();
					oGntRowStg.bindAggregation("shapes4", this._previousUtilizationBinding);
					oTreeTable.setRowSettingsTemplate(null);
					oTreeTable.setRowSettingsTemplate(oGntRowStg);
				}
			}
		},

		persistSettingsP13n: function () {
			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			var oGanttContainer = this.byId("idOrderGanttContainer");
			var oSettings = {};

			oSettings.bShowImpRel = oUIModel.getProperty("/showImpRel");
			oSettings.bShowExpRel = oUIModel.getProperty("/showExpRel");
			oSettings.bShowNonWorkingTimes = oUIModel.getProperty("/showNonWorkingTimes");
			oSettings.bShowCriticalPath = oUIModel.getProperty("/showCriticalPath");
			oSettings.bCondensedModeActive = oUIModel.getProperty("/condensedModeActive");
			oSettings.enableNowLine = oGanttContainer.getEnableNowLine();
			oSettings.enableCursorLine = oGanttContainer.getEnableCursorLine();
			oSettings.enableVerticalLine = oGanttContainer.getEnableVerticalLine();
			oSettings.enableStatusBar = oGanttContainer.getEnableStatusBar();
			oSettings.bShowFinalDueDate = oUIModel.getProperty("/showFinalDueDate");
			oSettings.bShowRestrictions = oUIModel.getProperty("/showRestrictions");
			oSettings.bShowUtilizationIndicator = oUIModel.getProperty("/showUtilizationIndicator");

			AppPersContainer.getInstance().getFeatureModel(Constants.sGanttP13nSettings).setProperty("/", oSettings);
			AppPersContainer.getInstance().saveContainer();

		},

		_refreshBinding: function (bRefresh) {
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var oBinding = oTreeTable.getBinding("rows");
			if (oBinding) {
				if (oBinding.aSorters && oBinding.aSorters.length > 0) {
					oBinding.aSorters[0].sPath = this.sSortOrderField;
					oBinding.aSorters[0].bDescending = this.sOrderSortOrder === "Descending" ? true : false;
				}
				if (bRefresh) {
					oBinding.refresh(true);
				}
			}
		},

		_setCondensedMode: function () {
			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			if (oUIModel.getProperty("/condensedModeActive")) {
				this.getView().addStyleClass(this.getOwnerComponent().getContentDensityAdditionalClass());
				this.getView().byId("idOrderGanttContainer").rerender();
			}
		},

		/** 
		 * This will update the UIModel with all values from Settings in Gantt of graphical view
		 * In case there are no settings yet (user has never applied own settings) they will all be set to false
		 * to have the UIModel ready for decision on UI control e.g shape visible or not
		 * @param {object} [oUIModel]  - UI model for GanttP13nSettings
		 * @param {object} [oSettings] - Settings object saved in GanttP13nSettings of AppPersContainer
		 */
		_updateUiModelFromGanttSettings: function (oUIModel, oSettings) {
			if (oSettings && oSettings.bShowImpRel !== null && oSettings.bShowImpRel !== undefined) {
				oUIModel.setProperty("/showImpRel", oSettings.bShowImpRel);
				oUIModel.setProperty("/showExpRel", oSettings.bShowExpRel);
				oUIModel.setProperty("/showCriticalPath", false);
				oUIModel.setProperty("/showNonWorkingTimes", oSettings.bShowNonWorkingTimes);
				oUIModel.setProperty("/condensedModeActive", oSettings.bCondensedModeActive);
				oUIModel.setProperty("/showFinalDueDate", oSettings.bShowFinalDueDate);
				oUIModel.setProperty("/showRestrictions", oSettings.bShowRestrictions);
				oUIModel.setProperty("/showUtilizationIndicator", oSettings.bShowUtilizationIndicator);
			} else {
				oUIModel.setProperty("/showImpRel", false);
				oUIModel.setProperty("/showExpRel", false);
				oUIModel.setProperty("/showCriticalPath", false);
				oUIModel.setProperty("/showNonWorkingTimes", false);
				oUIModel.setProperty("/condensedModeActive", false);
				oUIModel.setProperty("/showFinalDueDate", false);
				oUIModel.setProperty("/showRestrictions", false);
				oUIModel.setProperty("/showUtilizationIndicator", false);
			}
		},

		_setupSettings: function () {
			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			var oSettings = AppPersContainer.getInstance().getFeatureModel(Constants.sGanttP13nSettings).getProperty("/", "oSettings");

			this._updateUiModelFromGanttSettings(oUIModel, oSettings);
			if (oSettings.enableNowLine !== undefined || oSettings.enableCursorLine !== undefined || oSettings.enableVerticalLine !== undefined) {
				var oGanttContainer = this.getView().byId("idOrderGanttContainer");
				var mSettings = {
					enableNowLine: oSettings.enableNowLine !== undefined ? oSettings.enableNowLine : oGanttContainer.getEnableNowLine(),
					enableCursorLine: oSettings.enableCursorLine !== undefined ? oSettings.enableCursorLine : oGanttContainer.getEnableCursorLine(),
					enableVerticalLine: oSettings.enableVerticalLine !== undefined ? oSettings.enableVerticalLine : oGanttContainer.getEnableVerticalLine(),
					enableStatusBar: oSettings.enableStatusBar !== undefined ? oSettings.enableStatusBar : oGanttContainer.getEnableStatusBar()
				};
				oGanttContainer.applySettings(mSettings);
			}

			//----part of standard setting dialog will be cleaned up once new dialog is accepted-----------
			// var oContToolbar = this.byId("idGanttContainerToolbar");
			// var aSettingItems = oContToolbar.getSettingItems();
			// var aSettingsToRemove = [];
			// var oGantt = this.getView().byId("idOrderGanttContainer");
			// for (var i = 0; i < aSettingItems.length; i++) {
			// 	var sKey = aSettingItems[i].getKey();
			// 	if (this._aSettingsItemsNotToBeShown.indexOf(sKey) !== -1) {
			// 		aSettingsToRemove.push(aSettingItems[i]);
			// 	} else {
			// 		var tKey = sKey.substring(4);
			// 		var bPersValue = oSettings.getProperty("/" + tKey);

			// 		if (bPersValue !== undefined && bPersValue !== null) {
			// 			if (tKey === "enableNowLine") {
			// 				oGantt.setEnableNowLine(bPersValue);
			// 			} else if (tKey === "enableVerticalLine") {
			// 				oGantt.setEnableVerticalLine(bPersValue);
			// 			} else if (tKey === "enableCursorLine") {
			// 				oGantt.setEnableCursorLine(bPersValue);
			// 			}
			// 		} else {
			// 			bPersValue = true;
			// 		}
			// 		oUIModel.setProperty("/" + sKey, bPersValue);
			// 		aSettingItems[i].bindProperty("checked", {
			// 			path: "UIModel>/" + sKey
			// 		});
			// 	}
			// }

			// for (i = 0; i < aSettingsToRemove.length; i++) {
			// 	oContToolbar.removeSettingItem(aSettingsToRemove[i]);
			// }

			// oContToolbar.insertSettingItem(new SettingItem({
			// 	checked: "{UIModel>/showImpRel}",
			// 	displayText: "{i18n>showImpRelations}",
			// 	key: "sShowImpRel"
			// }), 5);
			// oContToolbar.insertSettingItem(new SettingItem({
			// 	checked: "{UIModel>/showExpRel}",
			// 	displayText: "{i18n>showExpRelations}",
			// 	key: "sShowExpRel"
			// }), 6);
			// oContToolbar.insertSettingItem(new SettingItem({
			// 	checked: "{UIModel>/showNonWorkingTimes}",
			// 	displayText: "{i18n>showNonWorkingTimes}",
			// 	key: "sShowNonWorkingTimes"
			// }), 7);

			// //Display condensed mode setting only for the desktop
			// //and hide for mobile and tablet devices
			// if (this.getOwnerComponent().getContentDensityAdditionalClass()) {
			// 	oContToolbar.insertSettingItem(new SettingItem({
			// 		checked: "{UIModel>/condensedModeActive}",
			// 		displayText: "{i18n>activateCondensedMode}",
			// 		key: "sCondensedModeActive"
			// 	}), 8);
			// }
			// oContToolbar.insertSettingItem(new SettingItem({
			// 	checked: "{UIModel>/showFinalDueDate}",
			// 	displayText: "{i18n>showFinalDueDate}",
			// 	key: "sShowFinalDueDate"
			// }), 9);
			// oContToolbar.insertSettingItem(new SettingItem({
			// 	checked: "{UIModel>/showRestrictions}",
			// 	displayText: "{i18n>showRestrictions}",
			// 	key: "sShowRestrictions"
			// }), 10);
			// oContToolbar.insertSettingItem(new SettingItem({
			// 	checked: "{UIModel>/showUtilizationIndicator}",
			// 	displayText: "{i18n>showUtilizationIndicator}",
			// 	key: "sShowUtilizationIndicator"
			// }), 11);

			// /*oContToolbar.insertSettingItem(new SettingItem({
			// 	checked: "{UIModel>/showCriticalPath}",
			// 	displayText: "{i18n>showCriticalPath}",
			// 	key: "sShowCriticalPath"
			// }), 7);*/
			//--------	
		},

		getRelVisibility: function (sExplicit, bShowImpRel, bShowExpRel) {
			if (sExplicit === "X") {
				return bShowExpRel ? 1 : 0;
			} else {
				return bShowImpRel ? 1 : 0;
			}
		},

		/** 
		 * returns the current variant key applied and Filter data
		 * @private 
		 * @returns {object} oAppState
		 */
		_getCurrentAppState: function () {
			var oSmartFilter = this.byId("idOrderGanttSmartFilterBar");
			var oGanttChartWithTable = this.getView().byId("idOrderGanttChartWithTable");
			var oAppState = {};
			this._oAppStateData.customData.selectionPanelSize = oGanttChartWithTable.getSelectionPanelSize();
			oAppState = this._oAppStateData.customData;
			var oVariantMgmt = oSmartFilter.getVariantManagement();

			oAppState.sCurrentVariantKey = oVariantMgmt.getCurrentVariantId() === "" ? oVariantMgmt.getStandardVariantKey() :
				oVariantMgmt.getCurrentVariantId();
			//get the Smart Filter data	
			oAppState.oFilterData = this._getCurrentFilterState(oSmartFilter, this._oStartDate, this._oEndDate);
			return oAppState;
		},

		/** 
		 * returns the current filter data.
		 * @private 
		 * @param {sap.ui.comp.smartfilterbar.SmartFilterBar} oSmartFilter SmartFlterBar UI element
		 * @returns {object} Filters 
		 */
		_getCurrentFilterState: function (oSmartFilter) {
			var aVisibleFields = [];
			var aHiddenFields = [];
			oSmartFilter.getAllFilterItems(true).forEach(function (oItem) {
				//Filters available in the Filter Dialog are considered as active filters.
				//Collect all the active fields of filter - including the association fields.
				aVisibleFields.push(oItem.getName());
				//Collect Unchecked active filters to be used for not displaying on the Filter Area in UI 
				//but will be used for filtering results
				if (oItem.getProperty("visibleInFilterBar") === false) {
					aHiddenFields.push(oItem.getName());
				}
			});

			return {
				aFilters: oSmartFilter.getFilterData(),
				aVisibleFields: aVisibleFields,
				aHiddenFields: aHiddenFields
			};
		},

		/**
		 * This method triggers search when the variants are updated and smart filterbar is initialized, in case app state is applied.
		 * @private
		 */
		_delayedTriggerSearch: function () {
			var oSmartFilter = this.getView().byId("idOrderGanttSmartFilterBar");
			if (oSmartFilter.isInitialised() && this._bIsAppStateApplied && !oSmartFilter.isCurrentVariantExecuteOnSelectEnabled()) {
				var oParams = {
					finalTrigger: true
				};
				oSmartFilter.fireSearch(oParams);
			}
			this._bFirstTriggerDone = true;
		},

		/**
		 * This method triggers the deffered table binding requests after the filter is triggered
		 * for the first time only
		 * @private
		 */
		_submitDelayedRequests: function () {
			this.getView().getModel().attachBatchRequestCompleted(this._requestComplete, this);
			this.getView().getModel().submitChanges({
				groupId: "iDBatchOrderFilterRequest"
			});
			//Remove the order filter batch group once the application is loaded
			var aCurrentDeferredBatchGroups = this.getView().getModel().getDeferredBatchGroups();
			var indexOfOrderFilterGroup = aCurrentDeferredBatchGroups.indexOf("iDBatchOrderFilterRequest");
			aCurrentDeferredBatchGroups.splice(indexOfOrderFilterGroup, 1);
			this.getView().getModel().setDeferredGroups(aCurrentDeferredBatchGroups);
			this._bSubmitofDeferredRequestsDone = true;
		},

		/** 
		 *  Sets the retrieved data from Appstate to Filters and if the variant is changed,
		 * applies the changed variant.
		 * @param {object} oSavedAppState contains the data from Appstate
		 * @param {boolean} isIAppState says if it is a forward navigation
		 */
		setAppState: function (oSavedAppState) {
			var oSmartFilter = this.byId("idOrderGanttSmartFilterBar");
			if (oSavedAppState && oSavedAppState.customData && Object.keys(oSavedAppState.customData).length !== 0) {
				//retrieve the variant from app state and apply the variant
				var oVariantContent = oSmartFilter.getVariantManagement().getVariantContent(oSmartFilter, oSavedAppState.customData.sCurrentVariantKey);

				// Restore the modified filter state -> reset the visiblity of fields
				if (this._isIAppState && oSavedAppState.customData.oFilterData) {
					if (oVariantContent) {
						//oSmartFilter.applyVariant(oVariantContent);
						oSmartFilter.setCurrentVariantId(oSavedAppState.customData.sCurrentVariantKey);
					}

					if (oSavedAppState.customData.oFilterData.aVisibleFields) {
						oSavedAppState.customData.oFilterData.aVisibleFields.forEach(function (sKey) {
							if (sKey) {
								oSmartFilter.addFieldToAdvancedArea(sKey);
							}
						});
						// If standard filter variant is modified then flag is set to enable the Restore button in filter PopUp on back navigation.
						if (oSmartFilter.getControlConfiguration().length !== oSavedAppState.customData.oFilterData.aVisibleFields.length) {
							oSmartFilter._oVariantManagement.currentVariantSetModified(true);
						}
					}
					// Visibilty of unchecked active filter fields will not be displayed in Filter Area of UI but considered for filtering. 
					if (oSavedAppState.customData.oFilterData.aHiddenFields) {
						oSavedAppState.customData.oFilterData.aHiddenFields.forEach(function (sKey) {
							if (sKey) {
								var oUncheckedFields = oSmartFilter._getFilterItemByName(sKey);
								oUncheckedFields.setVisibleInAdvancedArea(false);
							}
						});
					}
					// apply the retrieved the filter settings from Appstate to Smart filter.
					oSmartFilter.setFilterData(oSavedAppState.customData.oFilterData.aFilters, true);
				}
				//apply sort order
				if (oSavedAppState.customData.aSortColumn && oSavedAppState.customData.aSortColumn.hasOwnProperty("id")) {
					if (this.getView().byId(oSavedAppState.customData.aSortColumn.id)) {
						this.onSortRequest("", oSavedAppState.customData.aSortColumn);
					}
				}
			}
		},

		/** 
		 *  Based on user settings and whether the operation is on critical path,
		 * shows or hides the red bottom line below operartion
		 * @param {object} oOperationIsOnCriticalPath contains the data whether the operation is on critical path
		 * @param {object} bShowCriticalPath is a boolean variable which contains the value of "Visualize Critical Path" in user settings
		 * @returns {boolean} boolean value
		 * @private
		 */
		getOnCriticalVisibility: function (oOperationIsOnCriticalPath, bShowCriticalPath) {
			if (oOperationIsOnCriticalPath === "X" && bShowCriticalPath) {
				return true;
			} else {
				return false;
			}
		},

		/**
		 * Called when treetable column is selected for column width,visibility and sort change
		 * @private
		 * @param {Object} [oEvent] Event object returning the selected column
		 */
		_onPersChangeForColumns: function (oEvent) {
			var oTreeTable = this.getView().byId("idOrderTreeTable");
			var oGanttChartWithTable = this.getView().byId("idOrderGanttChartWithTable");
			this._oAppStateData = {
				customData: GanttUtils.getGanttColumnPersonalization(oTreeTable, oGanttChartWithTable, oEvent, this._oAppStateData)
			};
		},

		/** 
		 * Format text for Final Due Date Milestone in Gantt - shown when hovering over the shape
		 * @param {date} dFinalDueDate Final Due Date of order
		 * @returns {string} Text shown as hover tooltip
		 */
		getFFDMilestoneTitle: function (dFinalDueDate) {
			var sFinalDueDateText = "";
			if (dFinalDueDate) {
				var sFinalDueDate = sap.ui.core.format.DateFormat.getDateInstance().format(dFinalDueDate, true);
				sFinalDueDateText = this.getView().getModel("i18n").getResourceBundle().getText("FinalDueDateTooltip", [sFinalDueDate]);
				// return this._formatToLocale(this.removeTimeZoneOffset(dFinalDueDate));
			}
			return sFinalDueDateText;
		},

		/**
		 * Called when drag and drop is performed on a operation in order gantt
		 * @param {Object} [oEvent] Event object returning the selected item
		 */
		MoveOperationBasedOnDateChange: function (oEvent) {

			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.subscribeOnce(Constants.sLibraryChannel, Constants.sServerMessageToUpdateEntity, this.prepareTargetForRefreshGantt,
				this);
			var oModel = this.getView().getModel();
			var dStartDate = oEvent.getParameter("cursorDateTime");

			// Drag and drop is allowed only for future date 
			var oCurrentDate = new Date();
			if (dStartDate < oCurrentDate) {
				Utils.addMessage(this.getOwnerComponent().getModel("i18n").getResourceBundle().getText("ErrorMessageDragAndDroptoPastDates"),
					sap.ui.core.MessageType.Error, Constants.sDisplayTypeMessageBox);
			} else {
				var fStartDate = Utils.getAdjustedDate(dStartDate);
				var oTargetRow = oEvent.getParameter("targetRow");
				var oTargetShape = oEvent.getParameter("targetShape");
				//				var oRow = oModel.getObject(oTargetRow.getBindingContext().getPath());
				var oRow;

				this.getView().byId("idOrderGanttContainer").setBusy(true);

				if (oTargetRow && oTargetRow.getBindingContext()) {
					oRow = oModel.getObject(oTargetRow.getBindingContext().getPath());
				} else if (oTargetShape && oTargetShape.getParent() && oTargetShape.getParent().getBindingContext()) {
					oRow = oModel.getObject(oTargetShape.getParent().getBindingContext().getPath());
				}

				var oTimeFormat = sap.ui.core.format.DateFormat.getDateInstance({
					pattern: "PTHH'H'mm'M'ss'S'"
				});

				// Round off the time to a full hour as per user requirements
				var dFinalTime = Utils.roundDateToNearestDnDGranularity(dStartDate);
				//Converting the Time Selection to a Date Object 
				// inorder to format the value as per Backend understandable format			
				var formattedTime = oTimeFormat.format(dFinalTime);

				this._itemHashMap = new ItemHashMap();
				this._oChangeOperationsDelegate = new ChangeOperations();
				this._oChangeOperationsDelegate.scheduleOperationBasedOnDateChange(fStartDate, formattedTime, oRow, oModel, this._itemHashMap);

				// Trigger backend call
				var sGroupId = "massChange";
				this._itemHashMap.triggerBackendCall(sGroupId, Constants.sAfterDragAndDropFinalizedGanttApp);
			}
		},

		bindCalendarDefHelper: function () {

			var oCurrentTimePeriod = this._getCurrentTimePeriod();
			var oFromDate = encodeURIComponent(oCurrentTimePeriod.sCalendarStartDate.toISOString().substring(0, 19));
			var oToDate = encodeURIComponent(oCurrentTimePeriod.sCalendarEndDate.toISOString().substring(0, 19));

			var oUIModel = this._oOwnerComponent.getModel("UIModel");
			if (oUIModel.getProperty("/showNonWorkingTimes")) {
				//Bind calendar def only if it does not exists for the time period
				if (this.oFromDate === oFromDate && this.oToDate === oToDate && this.byId("idCalDef").getDefs().length) {
					return;
				}
				this.oFromDate = oFromDate;
				this.oToDate = oToDate;
				this.byId("idCalDef").bindAggregation("defs", {
					path: "/C_RSHOrderGanttCalendar(P_StartDate=datetime'" + oFromDate + "',P_EndDate=datetime'" +
						oToDate + "')/Set",
					parameters: {
						expand: "to_Intervals",
						//pass the groupID to separate Calendar and OrderOperation batch calls making them parallel
						groupId: "GetCalendars"
					},
					template: new Calendar({
						key: "{WorkCenterInternalID}",
						backgroundColor: "sapShell_Background",
						timeIntervals: {
							path: "to_Intervals",
							templateShareable: true,
							template: new TimeInterval({
								startTime: {
									path: "WorkCenterNonAvailStrtDteTme",
									formatter: this.removeTimeZoneOffset
								},
								endTime: {
									path: "WorkCenterNonAvailEndDteTme",
									formatter: this.removeTimeZoneOffset
								}
							})
						}
					})
				});
			} else
			if (!oUIModel.getProperty("/showNonWorkingTimes")) {
				this.byId("idCalDef").unbindDefs();
			}
		},

		/**
		 * Receives all the orders for which the change is performed, filters the changed operations for the given order
		 * @private
		 * @param {Array} [aChangedOrders] The model for the Gantt table
		 * @param {String} [sGivenOrder] The given order
		 * @returns {Array} [aChangedOperations] Changed operations for the given order
		 */
		_getCorrespondingChangedOperations: function (aChangedOrders, sGivenOrder) {
			var aChangedOperations = [];
			for (var i = 0; i < aChangedOrders.length; i++) {
				if (aChangedOrders[i].Order === sGivenOrder) {
					aChangedOperations.push(aChangedOrders[i].Operation);
				}
			}
			return aChangedOperations;
		},

		/**
		 * Get data for a property via a path in the model
		 * @private
		 * @param {Object} [oModel] The model for the Gantt table
		 * @param {String} [sPath] Path 
		 * @param {String} [sProperty] Property to be read
		 * @returns {String} Property value
		 */
		_getDataFromModel: function (oModel, sPath, sProperty) {
			return oModel.getProperty(sPath + "/" + sProperty);
		},

		/**
		 * Refer JSDoc for _findOperationsForUtilizationUpdate function for speacial scenario example
		 * Check if the already read entries have the previous work centers( Work_Center_1)
		 * Add this order/ operation filter (Order B Operation 4) as additional filters
		 * @private
		 * @param {Object} [oModel] The model for the Gantt table
		 * @param {Object} [oBinding] Binding for the Gantt table
		 * @param {Array} [aWorkCentersToRefresh] Collection of previous work centers that may or may not need update based on read entries
		 * @param {Array} [aExpandedNodesRootContexts] Collection of read entries exclusive to changed entries
		 * @returns {Array} [aOrderOpFilter] Additional filter
		 */
		_createAdditionalOrderOpFilterForUtilizationUpdate: function (oModel, oBinding, aWorkCentersToRefresh, aExpandedNodesRootContexts) {
			var aOrderOpFilter = [],
				oFilterSingleOperation = {};
			for (var i = 0; aWorkCentersToRefresh.length && i < aExpandedNodesRootContexts.length; i++) {
				var oExpandedKeys = oBinding.oKeys[aExpandedNodesRootContexts[i].substring(1)];
				for (var j = 0; aWorkCentersToRefresh.length && j < oExpandedKeys.length; j++) {
					var sOperationWorkCenter = this._getDataFromModel(oModel, "/" + oExpandedKeys[j], "MainWorkCenter");
					var iIndexOfWorkCenter = aWorkCentersToRefresh.indexOf(sOperationWorkCenter);
					if (iIndexOfWorkCenter !== -1) {
						aWorkCentersToRefresh.splice(iIndexOfWorkCenter, 1);
						oFilterSingleOperation = new Filter({
							filters: [
								new Filter("MaintenanceOrder", FilterOperator.EQ, this._getDataFromModel(oModel, "/" + oExpandedKeys[j], "MaintenanceOrder")),
								new Filter("MaintenanceOrderOperation", FilterOperator.EQ, this._getDataFromModel(oModel, "/" + oExpandedKeys[j],
									"MaintenanceOrderOperation"))
							],
							and: true
						});
						aOrderOpFilter.push(new Filter(oFilterSingleOperation, false));
					}
				}
			}
			return aOrderOpFilter;
		},

		/**
		 * The below function is introduced to handle the special scenario for indirect impact of work center change action.
		 * There are two orders, A and B
		 * ====================================
		 * A    | Operation 1  | Work_Center_1
		 *      | Operation 2  | Work_Center_2
		 * ====================================
		 * B    | Operation 3  | Work_Center_2
		 *      | Operation 4  | Work_Center_1
		 * ====================================
		 * Now expand both orders, perform work center change on Operation 1, change it to Work_Center_2
		 * The delta query reads all the operations for Order A, therefore, utilization for Work_Center_2 is updated
		 * However, the old work center(Work_Center_1)'s utilization is not updated.
		 * Additional affected order/ operation shall be queried representing unique work centers
		 * One update per work center should suffice as each work center utilization share same metadata id.
		 * @private
		 * @param {Array} [aOrderOperationsWithWCChange] Order/ Operations with work center change
		 * @returns {Array} [aOrderOpFilter] Order/ Operation filter representing unique work centers
		 */
		_findOperationsForUtilizationUpdate: function (aOrderOperationsWithWCChange) {
			var oTreeTableBinding = this.byId("idOrderTreeTable").getBinding("rows"),
				//Store the root node(Order) contexts
				aRootNodeContexts = oTreeTableBinding.getRootContexts(),
				//Order Contexts for which the operations are already read
				aExpandedNodesRootContexts = [],
				//Order Contexts for which the action was performed
				aChangedRootNodeContexts = [],
				i, j;

			for (i = 0; i < aOrderOperationsWithWCChange.length; i++) {
				for (j = 0; j < aRootNodeContexts.length; j++) {
					var sPath = aRootNodeContexts[j].sPath;

					if (!oTreeTableBinding.oKeys[sPath.substring(1)]) {
						//No need to check unread entries
						continue;
					}
					if (i === 0) {
						aExpandedNodesRootContexts.push(sPath);
					}
					if (sPath.indexOf(aOrderOperationsWithWCChange[i].Order) !== -1) {
						var iPresentInExpandedContexts = aExpandedNodesRootContexts.indexOf(sPath);
						if (iPresentInExpandedContexts !== -1) {
							aExpandedNodesRootContexts.splice(iPresentInExpandedContexts, 1);
						}
						aChangedRootNodeContexts.push(sPath);
					}
				}
			}

			var aUnChangedWorkCenters = [],
				aOldWorkCenter = [],
				oModel = oTreeTableBinding.getModel();
			//A order may have operations with changed work center, store the workcenters in aOldWorkCenter,
			//and operations for which work center is not changed, store these workcenters aUnChangedWorkCenters, ensure unique entries are stored.
			for (i = 0; i < aChangedRootNodeContexts.length; i++) {
				var oExpandedKeys = oTreeTableBinding.oKeys[aChangedRootNodeContexts[i].substring(1)];
				var sMaintenanceOrder = this._getDataFromModel(oModel, aChangedRootNodeContexts[i], "MaintenanceOrder");
				var aChangedOperations = this._getCorrespondingChangedOperations(aOrderOperationsWithWCChange, sMaintenanceOrder);

				for (j = 0; j < oExpandedKeys.length; j++) {
					var sWorkCenter = this._getDataFromModel(oModel, "/" + oExpandedKeys[j], "MainWorkCenter");
					if (aChangedOperations.indexOf(this._getDataFromModel(oModel, "/" + oExpandedKeys[j], "MaintenanceOrderOperation")) !== -1) {
						if (aOldWorkCenter.indexOf(sWorkCenter) === -1) {
							aOldWorkCenter.push(sWorkCenter);
						}
					} else {
						if (aUnChangedWorkCenters.indexOf(sWorkCenter) === -1) {
							aUnChangedWorkCenters.push(sWorkCenter);
						}
					}
				}
			}

			var aWorkCentersToRefresh = [],
				aOrderOpFilter = [];
			//Check do we need additional order/ operation query, if the unchanged work centers already contain the old work centers, the order delta read query should be sufficient
			for (i = 0; i < aOldWorkCenter.length; i++) {
				if (aUnChangedWorkCenters.indexOf(aOldWorkCenter[i]) === -1) {
					aWorkCentersToRefresh.push(aOldWorkCenter[i]);
				}
			}

			//The special scenario, create the additonal filter
			if (aWorkCentersToRefresh.length) {
				aOrderOpFilter = this._createAdditionalOrderOpFilterForUtilizationUpdate(oModel, oTreeTableBinding, aWorkCentersToRefresh,
					aExpandedNodesRootContexts);
			}

			return aOrderOpFilter;
		},

		/** The core function to formulate and initiate delta queries/ read requests in order to update the changed orders/ operations.
		 * Invoked upon publish of event "serverMessageToUpdateEntity", in this case the channel is rsh.eam.lib.common.
		 * Also invoked manually after the relationship creation is successful, this case the channel and event are empty.
		 * 
		 * There are two read queries(_performDeltaReadQuery) one for the order level, other for operation level.
		 * The order and operation(_adjustFiltersForOpQuery) queries are enhanced with filters, such as the orders/ operations changed, the time period, etc.
		 * And with urlParameters, such as $expand: to_Relationships, ( _getUrlParametersForDeltaRefresh), and so on.
		 * 
		 * The status change action, say changing to due or dispatch and the other actions, say the mass change, create relationship, these two scenarios need different
		 * handling as latter results in rescheduling, and therefore, the indicator "iNotAStatusChangeAction" is used to differentiate between the two.
		 * In case of status change only the particular order/ operation within the time period is requested, in other cases the entire order with all its operations beyond time period is requested.
		 * 
		 * Handled scenarios: When there is a reordering of all the operations and they stay within the visible time horizon, the result looks same as full refresh.
		 * Differently handled scenarios: If the operation move out of the visible time horizon, then no shapes are displayed against it,
		 * and no actions can be performed on it(checkIfOperationIsWithinTimePeriod).
		 * Unhandled scenario: Due to rescheduling new operation can also be a part of visible time horizon, here, this operation is not visible unlike full refresh.
		 * 
		 * Flow goes to "_onAfterActionsCompleted" directly if no actual change was done, or after all the read queries(Order & Operation) are completed in order to take care
		 * of busy indicators and closing dialogs if any.
		 * 
		 * Note:If the utilization indicator setting is on, "Work center change action" needs special handling (findOperationsForUtilizationUpdate)
		 * 
		 * @public
		 * @param {Object} [sChannel] Channel of the event
		 * @param {Object} [sEvent] The name of event
		 * @param {Object} [oTargetsAndParams] Object comprising a flag(bRefreshOfSourceAppRequired) whether read queries need to be done,
		 * object list of all the changes(itemHashMapContainer), where each change has the action, order, operation and if the change was done via mass change dialog,
		 * the reference to invoke onAfterDataRecievedFn is also present which eventually closes the dialog.
		 *
		 */
		prepareTargetForRefreshGantt: function (sChannel, sEvent, oTargetsAndParams) {
			var oModel = this.byId("idOrderTreeTable").getModel();
			var sPath = "/C_RSHOrdersAndOperations";
			var oUIModel = this.getModel("UIModel");
			var oUrlParams = {};

			var aFilter = [],
				oFilterSingleOperation,
				aOrderOpFilter = [],
				aOrder = [],
				aOrderFilter = [];

			var oTargets = oTargetsAndParams.itemHashMapContainer;

			//ensure Gantt gets refreshed after changes, if there was a change performed
			if (!oTargetsAndParams.parameters.bRefreshOfSourceAppRequired) {
				this._onAfterActionsCompleted(oTargetsAndParams.parameters);
				return;
			}

			//Flag to determine if change operation is performed
			var iNotAStatusChangeAction = 0;
			var aStoreWorkCentersChanged = [];
			if (sChannel !== "" && sEvent !== Constants.sOnRelationshipDelete) {
				for (var property in oTargets) {
					if (oTargets.hasOwnProperty(property)) {
						var aTarget = property.split(",");
						if (iNotAStatusChangeAction === 0) {
							iNotAStatusChangeAction = (aTarget[2] === Constants.workcenterAction || aTarget[2] === Constants.reassignWorkCenterAction ||
								aTarget[
									2] ===
								Constants.schedulingOperationAction || aTarget[2] === Constants.removeConstraintsAction) ? 1 : 0;
						}
						if (aTarget[2] === Constants.workcenterAction) {
							var oOrderOpWithWCChange = {
								Order: aTarget[0],
								Operation: aTarget[1]
							};
							aStoreWorkCentersChanged.push(oOrderOpWithWCChange);
						}

						//Create Filter for particular order and operation 
						oFilterSingleOperation = new Filter({
							filters: [
								new Filter("MaintenanceOrder", FilterOperator.EQ, aTarget[0]),
								new Filter("MaintenanceOrderOperation", FilterOperator.EQ, aTarget[1])
							],
							and: true
						});
						aOrderOpFilter.push(new Filter(oFilterSingleOperation, false));

						//Create Filter for Order
						if (!aOrder.includes(aTarget[0])) {
							aOrder.push(aTarget[0]);
							aOrderFilter.push(new Filter("MaintenanceOrder", FilterOperator.EQ, aTarget[0]));
						}
					}
				}
			} else { /*Refresh orders after relationship creation*/
				oTargets.forEach(function (order) {
					iNotAStatusChangeAction = 1;
					if (aOrder.indexOf(order) === -1) {
						aOrder.push(order);
						aOrderFilter.push(new Filter("MaintenanceOrder", FilterOperator.EQ, order));
					}
				});
			}
			if (aStoreWorkCentersChanged.length && oUIModel.getProperty("/showUtilizationIndicator")) {
				var aFiltersForUtilInd = this._findOperationsForUtilizationUpdate(aStoreWorkCentersChanged);
			}

			//Pass by value Order Filter
			var aOrderFilterCopy = aOrderFilter.slice();

			//Prepare filters for Operation call. For Mass Change we need to fetch all the operations and for other actions just the changed operation.
			aFilter = this._adjustFiltersForOpQuery(iNotAStatusChangeAction, aOrderFilterCopy, aFiltersForUtilInd, aOrderOpFilter,
				oUIModel.getProperty("/showUtilizationIndicator"));

			var _sSelectSubStringOperations = this._sOperationAppStateFields ? this._sOperationAllTechMandatoryFields + this._sOperationAppStateFields :
				this
				._sOperationAllTechMandatoryFields;

			oUrlParams = this._getUrlParametersForDeltaRefresh(oUIModel.getProperty("/showImpRel"), oUIModel.getProperty("/showExpRel"),
				oUIModel.getProperty("/showUtilizationIndicator"), _sSelectSubStringOperations);

			var oOperationReadCall = this._performDeltaReadQuery(oModel, sPath, aFilter, oUrlParams);

			//Prepare filters for Order call
			aFilter = [];

			aFilter.push(new Filter(aOrderFilter, false));
			aFilter.push(new Filter({
				filters: [
					new Filter("OrderOperationRowLevel", FilterOperator.EQ, 0)
				],
				and: true
			}));

			var _sSelectSubStringOrders = this._sOrderAppStateFields ? this._sOrderAllTechMandatoryFields + "," + this._sOrderAppStateFields :
				this
				._sOrderAllTechMandatoryFields;

			oUrlParams = this._getUrlParametersForDeltaRefresh(oUIModel.getProperty("/showImpRel"), oUIModel.getProperty("/showExpRel"), false /*No need to query Utilization for Order */ ,
				_sSelectSubStringOrders);

			var oOrderReadCall = this._performDeltaReadQuery(oModel, sPath, aFilter, oUrlParams);

			Promise.all([oOperationReadCall, oOrderReadCall]).then(this._onAfterActionsCompleted(oTargetsAndParams.parameters));

		},

		/**
		 * This will create a combination of filter required for Operation Delta Query, if mass change action is performed, or remove constraints
		 * then entire order is queried,
		 * if there was change work center action, and there are order/ operations indirectly affected, then include this filter as well
		 * Add datetime filter if utilization is to be queried
		 * In other case, for status change actions, query only the changed operation, for ex: dispatch
		 * @private
		 * @param {Integer} [iNotAStatusChange] If the action performed was mass change?
		 * @param {Array} [aOrderFilter] Collection of changed orders filters
		 * @param {Array} [aUtilIndFilter] Collection of minimum order/operation indirectly affected by work center change action filters
		 * @param {Array} [aOrderOpFilter] Collection of changed operations filters
		 * @param {Boolean} [bShowUtilInd] If utilization indicator setting is ON/ OFF
		 * @returns {Array} [aFilter] Adjusted filter
		 */
		_adjustFiltersForOpQuery: function (iNotAStatusChange, aOrderFilter, aUtilIndFilter, aOrderOpFilter, bShowUtilInd) {
			var aFilter = [];
			if (iNotAStatusChange === 1) {
				if (aUtilIndFilter && aUtilIndFilter.length) {
					aFilter.push(new Filter(aOrderFilter, false));
					aFilter[0].aFilters.push(new Filter(aUtilIndFilter, false));
				} else {
					aFilter.push(new Filter(aOrderFilter, false));
				}
				//For mock request to distinguish between Order & Operation
				if (Utils.isMockRun()) {
					aFilter.push(new Filter("OrderOperationRowLevel", FilterOperator.EQ, 1));
				}
			} else {
				aFilter.push(new Filter(aOrderOpFilter, false));
			}
			if (bShowUtilInd) {
				var oCurrentTimePeriod = this._getCurrentTimePeriod();
				var oDateTimeFilter = new Filter({
					filters: [
						new Filter("StartDate", FilterOperator.EQ, oCurrentTimePeriod.sCalendarStartDate),
						new Filter("EndDate", FilterOperator.EQ, oCurrentTimePeriod.sCalendarEndDate)
					],
					and: true
				});
				aFilter[0].aFilters.push(new Filter(oDateTimeFilter, false));
			}
			return aFilter;
		},

		/**
		 * This function will trigger delta read query and returns a promise to caller function for initiating further tasks,
		 * such as maintaining busy indicators.
		 * @private
		 * @param {Object} [oModel] Model to be queried
		 * @param {String} [sPath] Path to be read, here it is /C_RSHOrdersAndOperations
		 * @param {Array} [aFilter] Array of filters required for call, can be a combination of orders, operations, datetime filter
		 * @param {Object} [oUrlParams] The information about expand and select based on the Gantt settings.
		 * @returns {Object} A promise which will be resolved once data is received
		 */
		_performDeltaReadQuery: function (oModel, sPath, aFilter, oUrlParams) {
			return new Promise(function (resolve, reject) {
				oModel.read(sPath, {
					filters: aFilter,
					urlParameters: oUrlParams,
					success: function (oData) {
						resolve();
					},
					error: function () {
						resolve();
					}
				});
			});
		},

		/**
		 * Function to update delta refresh query paramters based on Gantt settings.
		 * @private
		 * @param {Boolean} [bShowImp] Implicit relationship on/ off
		 * @param {Boolean} [bShowExp] Explicit relationship on/ off
		 * @param {Boolean} [bShowUtilInd] Utilization indicator on/ off
		 * @param {String} [sSelectSubString] All the Select fields for orders/ operations 
		 * @returns {Object} oUrlParams 
		 */
		_getUrlParametersForDeltaRefresh: function (bShowImp, bShowExp, bShowUtilInd, sSelectSubString) {
			var sExpandString = "",
				sSelectString = sSelectSubString;
			var oUrlParams = {};

			if (bShowImp || bShowExp) {
				sExpandString = "to_Relationships";
				sSelectString = sSelectString + "," + "to_Relationships";
			}
			if (bShowUtilInd) {
				sExpandString = sExpandString ? sExpandString + "," + "to_UtilIndicator" : "to_UtilIndicator";
				sSelectString = sSelectString + "," + "to_UtilIndicator";
			}
			if (sExpandString) {
				oUrlParams = {
					"$expand": sExpandString,
					"$select": sSelectString
				};
			} else {
				oUrlParams = {
					"$select": sSelectString
				};
			}
			return oUrlParams;
		},

		initSortOrderAndSortOperationFields: function () {
			this.sSortOrderField = "MaintenanceOrder";
			this.sSortOperationField = "MaintenanceOrderOperation";
			this.sOrderSortOrder = "Ascending";
			this.sOperationSortOrder = null;
		},

		onPrint: function () {
			var that = this;
			var oGanttPrinting = new GanttPrinting({
				ganttChart: that.getView().byId("idOrderGanttChartWithTable")
			});
			oGanttPrinting.open();
		},

		/** 
		 * Opens Context Menu Action Sheet/Popover based on the type of shape under right click
		 * @param {Object} [oEvent] Event object triggered by right click on shape in Gantt Chart
		 */
		onShapeContextMenu: function (oEvent) {
			var oShape = oEvent.getParameter("shape");
			var oView = this.getView();
			if (oShape instanceof Relationship) {
				var sPath = oShape.getBindingContext().getPath();
				var oData = oShape.getModel().getData(sPath);
				if (oData.RelationshipIsExplicit === "X") {
					//Reletionship color gets changed to red on right mouse click. To avoid this, setting the color of relationship to Informative
					oShape.setSelectedStroke("@sapUiInformative");
					var oEventBus = sap.ui.getCore().getEventBus();
					//Subscribe event to delete relationship
					oEventBus.subscribe(Constants.sLibraryChannel, Constants.sRelationshipDeleteInGantt, this.onDeleteRelationship, this);
					//Subscribe event to call handler method to unscubscribe the delete relationship event on context menu close
					oEventBus.subscribeOnce(Constants.sLibraryChannel, Constants.sRelationshipDeleteContextMenuClose, this.onDeleteRelationshipContextMenuClose,
						this);
					if (!this.oRelationshipActionSheet) {
						this.oRelationshipActionSheet = new RelationshipActionSheet();
					}
					this.oRelationshipActionSheet.onOpen(oEvent, oView, oShape);
				}
			} else if (oShape.getMetadata().getName() === "sap.gantt.simple.BaseGroup") {
				this._oShapeForOpContextMenu = oShape;
				var _iPageX = oEvent.getParameter("pageX");
				var _iPageY = oEvent.getParameter("pageY");
				var sOpShapePath = oShape.getBindingContext().getPath();
				var oOperationData = this.getModel().getData(sOpShapePath);
				if (oOperationData.ProcessingStatusText === "In Process") {
					var oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
					Utils.addMessage(oResourceBundle.getText("InfoMessageOperationInProcessStatus"), sap.ui.core.MessageType.Information, Constants.sDisplayTypeMessageToast);
				} else {
					if (!this._oShapeContextMenu) {
						// load asynchronous XML fragment
						Fragment.load({
							id: oView.getId(),
							name: "rsh.eam.ordergantts1.view.OperationActionSheet",
							type: "XML",
							controller: this
						}).then(function (oContextMenu) {
							this._oShapeContextMenu = oContextMenu;
							oView.addDependent(oContextMenu);
							this._setupOperationShapeContextMenu(oOperationData.ProcessingStatusText, oOperationData.OpBscStartDateConstraintType);
							this.openOperationShapeContextMenu(_iPageX, _iPageY);
						}.bind(this));
					} else {
						this._setupOperationShapeContextMenu(oOperationData.ProcessingStatusText, oOperationData.OpBscStartDateConstraintType);
						this.openOperationShapeContextMenu(_iPageX, _iPageY);
					}
				}
			}
		},

		onDeleteRelationship: function (sChannel, sEvent, oShape) {
			this.getView().byId("idOrderGanttContainer").setBusy(true);
			var oModel = this.getView().getModel("relationshipModel");
			var sPath = oShape.getBindingContext().getPath();
			var oRelationshipData = oShape.getModel().getData(sPath);

			var sFromOperation = oRelationshipData.PredecessorOrderOperation;
			var sToOperation = oRelationshipData.SuccessorOrderOperation;
			var sFromOrderRow = oRelationshipData.PredecessorOrder;
			var sToOrderRow = oRelationshipData.SuccessorOrder;

			// Get the relationship type
			var sRelationshipType = oShape.getProperty("type");
			// Get the internal relationship type
			var sInternalRelationshipType = this._getInternalRelationshipType(sRelationshipType);
			var oResourceBundle = sap.ui.getCore().getLibraryResourceBundle("sap.rsh.eam.lib.common");
			var that = this;
			oModel.remove(
				"/C_RSHMaintenanceOrdOpRelshpTP(MaintenanceOrder='" + this._addPaddingAtStart(12, oRelationshipData.PredecessorOrder) +
				"',MaintenanceOrderOperation='" + sFromOperation +
				"',MaintenanceOrderSubOperation='" + encodeURIComponent(" ") + "',MaintOrdOperationIsSuccessor=" + false +
				",RelatedMaintenanceOrder='" + this._addPaddingAtStart(12, oRelationshipData.SuccessorOrder) +
				"',RelatedMaintOrderOperation='" + sToOperation + "',OrderOpRelationshipIntType='" + sInternalRelationshipType + "')", {
					success: function (oData) {
						var oTargetParams = {};
						oTargetParams.itemHashMapContainer = [];
						oTargetParams.itemHashMapContainer.push(sFromOrderRow);
						oTargetParams.itemHashMapContainer.push(sToOrderRow);
						oTargetParams.parameters = {};
						oTargetParams.parameters.bRefreshOfSourceAppRequired = true;
						Utils.addMessage(oResourceBundle.getText("RelationshipDeletionSuccess"), sap.ui.core.MessageType.Success, Constants.sDisplayTypeMessageToast);
						//Trigger delta refresh query
						that.prepareTargetForRefreshGantt("", "", oTargetParams);
					},
					error: function (oError) {
						Utils.addMessage(oResourceBundle.getText("RelationshipDeletionError"), sap.ui.core.MessageType.Success, Constants.sDisplayTypeMessageToast);
						that.getView().byId("idOrderGanttContainer").setBusy(false);
					}
				});
		},

		/** 
		 * Event handler raised after closing relationship popover
		 * Unsubrcibe deletion event and set back relationship shape as needed
		 * @param {string} [sChannel] Channel in which the event is raised
		 * @param {string} [sEvent] Event name of the raised event
		 * @param {object} [oShape] Relationshipshape for which the popover was opened
		 */
		onDeleteRelationshipContextMenuClose: function (sChannel, sEvent, oShape) {
			var oEventBus = sap.ui.getCore().getEventBus();
			oEventBus.unsubscribe(Constants.sLibraryChannel, Constants.sRelationshipDeleteInGantt, this.onDeleteRelationship, this);
			// Deselect shape and adjust coloring
			if (oShape) {
				oShape.setSelectedStroke(null);
				oShape.setSelected(false); //Does not work to set back the color of the stroke, stroke color stays selected; Issue to control team needs to be raised
			}
		},

		openOperationShapeContextMenu: function (iPageX, iPageY) {
			//Placeholder to display the operatoin actionsheet next to the mouse cursor
			var oPlaceHolder = new sap.m.Label();
			var oPopup = new sap.ui.core.Popup(oPlaceHolder, false, true, false);
			var eDock = sap.ui.core.Popup.Dock;
			//Setting the offset to display the operation context menu fragment next to the mouse cursor
			var sOffset = (iPageX + 1) + " " + (iPageY - 15);
			oPopup.open(0, eDock.BeginTop, eDock.LeftTop, null, sOffset);
			this._oShapeContextMenu.openBy(oPlaceHolder);
		},

		/** 
		 * Sets up the visibility of context menu buttons for Operation Shapes based on their status and Constraint type
		 * @private  
		 * @param {String} [sOpProcessingStatusText] Processing Status Text of the Operation shape under right click
		 * @param {String} [sOpBscStartDateConstraintType] Start Constraint Type of the Operation shape under right click
		 */
		_setupOperationShapeContextMenu: function (sOpProcessingStatusText, sOpBscStartDateConstraintType) {
			if (sOpProcessingStatusText === "Due") {
				this.byId("idButtonChangeAction").setProperty("visible", true);
				this.byId("idButtonDispatchAction").setProperty("visible", true);
				this.byId("idButtonCancDispatchAction").setProperty("visible", false);
			} else if (sOpProcessingStatusText === "Dispatched") {
				this.byId("idButtonChangeAction").setProperty("visible", true);
				this.byId("idButtonDispatchAction").setProperty("visible", false);
				this.byId("idButtonCancDispatchAction").setProperty("visible", true);
			}
			if (sOpBscStartDateConstraintType === "1") {
				this.byId("idButtonRemoveConstraintsAction").setProperty("visible", true);
			} else {
				this.byId("idButtonRemoveConstraintsAction").setProperty("visible", false);
			}
		},

		onExit: function () {
			//Finally write app state
			this._oInnerAppState = {
				customData: this._getCurrentAppState()
			};
			AppPersContainer.getInstance().getFeatureModel(Constants.sGanttAppState).setProperty("/", this._oInnerAppState);
			AppPersContainer.getInstance().saveContainer();
		}
	});

});