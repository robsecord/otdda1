// Meteor Components
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { CurrentClaim } from '/imports/utils/current-claim';
import { Helpers } from '/imports/utils/common';
import { log } from '/imports/utils/logging';

// Globals
import {
    HOLIDAY_ICON_MAP
} from '/imports/utils/global-constants';

// Template Component
import './day-card.component.html';


Template.dayCardComponent.onCreated(function Template_dayCardComponent_onCreated(){
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    instance.dayIndex = new ReactiveVar(instance.data.day);
    instance.dayPrice = new ReactiveVar('');

    instance.autorun(() => {
        const tplData = Template.currentData();
        Session.get('accountNickname');
        instance.dayIndex.set(tplData.day);
    });

    instance.autorun(() => {
        if (!instance.eth.hasNetwork) { return; }

        // Watch for changes to Language and Current Claim and Update Price
        CurrentClaim.changeTrigger.get();
        TAPi18n.getLanguage();

        instance.contract.getDayPrice(instance.dayIndex.get())
            .then(result => instance.dayPrice.set(String(result)))
            .catch(log.error);
    });
});

Template.dayCardComponent.onRendered(function Template_dayCardComponent_onRendered() {
    const instance = this;
    instance.autorun(() => {
        // Watch for changes to Language and Current Claim and Update Price
        CurrentClaim.changeTrigger.get();
        TAPi18n.getLanguage();

        Meteor.defer(() => $('[data-toggle="popover"]').popover({trigger: 'hover', placement: 'bottom'}));
    });
});

Template.dayCardComponent.helpers({

    getMonth() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex.get();
        return Helpers.getMonthDayFromIndex(dayIndex).month;
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
        const dayIndex = instance.dayIndex.get();
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return TAPi18n.__(holiday.title);
    },

    getHolidayDesc() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex.get();
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return TAPi18n.__(holiday.desc);
    },

    getMonthClass() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex.get();
        const {month} = Helpers.getMonthDayFromIndex(dayIndex);
        return `month${month}`;
    },

    getDayLabel() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex.get();
        return Helpers.getMonthDayFromIndex(dayIndex).day;
    },

    getNextPrice() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }
        return instance.eth.web3.fromWei(instance.dayPrice.get(), 'ether').toString(10);
    }

});
