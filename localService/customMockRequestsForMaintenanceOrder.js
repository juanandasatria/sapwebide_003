/*
 * Copyright (C) 2009-2021 SAP SE or an SAP affiliate company. All rights reserved.
 */
sap.ui.define(["jquery.sap.global"],function(q){"use strict";var m={_aRequestedKeys:null,_sEntryFound:null,_aKeys:null,_oEntitySet:null,connectTwoOperations:function(){return{method:"POST",path:new RegExp("(C_RSHMaintenanceOrdOperationTP)(\\(([^/\\?#]+)\\)/?(.*)?)?"),response:function(x,u){var r=new XMLHttpRequest();r.onload=(function(R){var M={};M=R.target.responseHeaders["sap-message"];var h={"sap-message":M};x.respondJSON(R.target.status,h,R.target.responseText);return true;});r.open("POST","/sap/opu/odata/sap/RSH_EAM_ORDER_GANTT_SRV/"+"C_RSHOperationRelationships",false);r.send(x.requestBody);return true;}};},getRequests:function(r,t){this.addRequest(r,this.connectTwoOperations(),t);return r;},addRequest:function(r,c,t){var R=r.find(function(i){return i.path.toString()===c.path.toString();});if(R){R.response=c.response.bind(t);}else{R=c;R.response=c.response.bind(t);r.push(R);}}};return m;},true);