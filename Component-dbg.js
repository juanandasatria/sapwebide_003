/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define([
	"sap/ui/core/UIComponent",
	"sap/ui/Device",
	"rsh/eam/ordergantts1/model/models",
	"sap/rsh/eam/lib/common/utils/utils",
	"sap/rsh/eam/lib/common/utils/AppState",
	"sap/rsh/eam/lib/common/utils/AppPersContainer"
], function (UIComponent, Device, models, utils, AppState, AppPersContainer) {
	"use strict";

	return UIComponent.extend("rsh.eam.ordergantts1.Component", {

		metadata: {
			manifest: "json",
			config: {
				fullWidth: true
			}
		},

		/**
		 * The component is initialized by UI5 automatically during the startup of the app and calls the init method once.
		 * In this function, the device models are set and the router is initialized.
		 * @public
		 * @override
		 */
		init: function () {
			// call the base component's init function
			UIComponent.prototype.init.apply(this, arguments);

			// set the device model
			this.setModel(models.createDeviceModel(), "device");

			// create the views based on the url/hash
			this.getRouter().initialize();

			//create a AppPersContainer Instance to manage the PersContainer Service
			AppPersContainer.createInstance(this);

			// set default Calendar week start date as Monday 
			utils.setMondayFirstDayOfWeek();

			// Create an AppState instance for the app.
			AppState.createInstance(this);
			this.getModel().setDeferredGroups(this.getModel().getDeferredGroups().concat(["iDBatchOrderFilterRequest"]));
			this.getModel().setChangeGroups({
				"C_RSHOrdersAndOperationsType": {
					groupId: "iDBatchOrderFilterRequest",
					changeSetId: "iDBatchOrderFilterRequest",
					single: false
				}
			});
			this.getModel().setRefreshAfterChange(false);
		},

		/**
		 * The component is destroyed by UI5 automatically.
		 * @public
		 * @override
		 */
		destroy: function () {
			// call the base component's destroy function
			UIComponent.prototype.destroy.apply(this, arguments);
		},

		/**
		 * This method can be called to determine whether the sapUiSizeCompact or sapUiSizeCozy
		 * design mode class should be set, which influences the size appearance of some controls.
		 * @public
		 * @return {string} css class, either 'sapUiSizeCompact' or 'sapUiSizeCozy' - or an empty string if no css class should be set
		 */
		getContentDensityClass: function () {
			if (this._sContentDensityClass === undefined) {
				// check whether FLP has already set the content density class; do nothing in this case
				if (jQuery(document.body).hasClass("sapUiSizeCozy") || jQuery(document.body).hasClass("sapUiSizeCompact")) {

					//if compact mode is set, remember condensed mode class name as additional option based on user settings in Gantt
					if (jQuery(document.body).hasClass("sapUiSizeCompact")) {
						this._sContentDensityAdditionalClass = "sapUiSizeCondensed";
						this._sContentDensityClass = "";
					} else {
						this._sContentDensityClass = "";
					}

				} else if (!Device.support.touch) { // apply "compact" mode if touch is not supported
					this._sContentDensityClass = "sapUiSizeCompact";
				} else {
					// "cozy" in case of touch support; default for most sap.m controls, but needed for desktop-first controls like sap.ui.table.Table
					this._sContentDensityClass = "sapUiSizeCozy";
				}
			}
			return this._sContentDensityClass;
		},

		getContentDensityAdditionalClass: function () {
			if (this._sContentDensityAdditionalClass === undefined) {
				if (jQuery(document.body).hasClass("sapUiSizeCompact")) {
					//if compact mode is set, add condensed mode in addition based on user settings
					this._sContentDensityAdditionalClass = "sapUiSizeCondensed";
				}
			}
			return this._sContentDensityAdditionalClass;
		}

	});
});