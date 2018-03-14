// Meteor Components
import { FlowRouter } from 'meteor/kadira:flow-router';
import { Random } from 'meteor/random';
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { CurrentClaim } from '/imports/utils/current-claim';
import { Helpers } from '/imports/utils/common';

// Globals
import {
    HOLIDAY_ICON_MAP
} from '/imports/utils/global-constants';

// Template Components
import './claim.component.html';


Template.claimComponent.onCreated(function Template_claimComponent_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();

    instance.dayIndex = new ReactiveVar(0);

    // Watch changes to Selected Day for Current-Claim
    instance.autorun(() => {
        const selectedMonth = Session.get('selectedMonth');
        const selectedDay = Session.get('selectedDay');

        // Get Day-Index Range for Selected Month
        const range = Helpers.getDayIndexRange(selectedMonth);
        instance.dayIndex.set(range[0] + selectedDay - 1);

        // Update DOM Elements
        Meteor.defer(() => {
            $('[data-toggle="tooltip"]').tooltip({container: 'body'});
            $('[data-toggle="popover"]').popover({trigger: 'hover', placement: 'left'});
        });
    });
});

Template.claimComponent.helpers({

    canMakeClaim() {
        const instance = Template.instance();
        if (!instance.eth.hasAccount || !instance.eth.coinbase) { return false; }

        // Watch for changes to Current Claim and Update Price
        CurrentClaim.changeTrigger.get();
        Session.get('latestClaim');
        return (CurrentClaim.ownerAddress !== instance.eth.coinbase);
    },

    hasHoliday() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex.get();
        return !_.isUndefined(_.find(HOLIDAY_ICON_MAP, {dayIndex}));
    },

    getHolidayIcon() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex.get();
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return holiday.img;
    },

    getHolidayTitle() {
        const instance = Template.instance();
        TAPi18n.getLanguage();
        const dayIndex = instance.dayIndex.get();
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return TAPi18n.__(holiday.title);
    },

    getHolidayDesc() {
        const instance = Template.instance();
        TAPi18n.getLanguage();
        const dayIndex = instance.dayIndex.get();
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return TAPi18n.__(holiday.desc);
    },

    getMonth() {
        return Session.get('selectedMonth');
    },

    getCurrentPrice() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }

        // Watch for changes to Current Claim and Update Price
        CurrentClaim.changeTrigger.get();
        Session.get('latestClaim');
        return instance.eth.web3.fromWei(CurrentClaim.price, 'ether').toString(10);
    },

    hasCurrentOwner() {
        CurrentClaim.changeTrigger.get();
        Session.get('latestClaim');
        return !_.isEmpty(CurrentClaim.owner) && !Helpers.isAddressZero(CurrentClaim.owner);
    },

    getCurrentOwner() {
        // Watch for changes to Current Claim and Update Owner
        CurrentClaim.changeTrigger.get();
        Session.get('latestClaim');
        return CurrentClaim.owner;
    },

    getColorFromAddress() {
        CurrentClaim.changeTrigger.get();
        Session.get('latestClaim');
        return Helpers.getStylesForAddress(CurrentClaim.ownerAddress);
    },

    getDayLabel() {
        const instance = Template.instance();
        return Helpers.getMonthDayFromIndex(instance.dayIndex.get()).day;
    }

});