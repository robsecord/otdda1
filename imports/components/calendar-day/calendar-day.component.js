// Meteor Components
import { Random } from 'meteor/random';
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { Helpers } from '/imports/utils/common';
import { DayPrices } from '/imports/utils/day-prices';
import { log } from '/imports/utils/logging';

// Globals
import {
    HOLIDAY_ICON_MAP
} from '/imports/utils/global-constants';

// Template Component
import './calendar-day.component.html';

Template.calendarDayComponent.onCreated(function Template_calendarDayComponent_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    instance.standalone = instance.data.data.standalone || false;
    instance.dayToDisplay = new ReactiveVar(instance.data.data.day);
    instance.ownerName = new ReactiveVar('');

    instance.autorun(() => {
        const tplData = Template.currentData();
        Session.get('accountNickname');
        instance.dayToDisplay.set(tplData.data.day);

        // Get Index of Day
        const range = Helpers.getDayIndexRange(tplData.data.month);
        instance.dayIndex = range[0] + tplData.data.day - 1;

        DayPrices.owners[instance.dayIndex].changed.get();
        if (DayPrices.owners[instance.dayIndex].address) {
            Helpers.getFriendlyOwnerName(instance.contract, DayPrices.owners[instance.dayIndex].address)
                .then(name => instance.ownerName.set(name))
                .catch(log.error);
        }
    });
});

Template.calendarDayComponent.helpers({

    getClass() {
        const instance = Template.instance();
        return instance.standalone ? 'standalone' : '';
    },

    getDay() {
        const instance = Template.instance();
        return instance.dayToDisplay.get();
    },

    getCurrentPrice() {
        const instance = Template.instance();
        if (!instance.eth.hasNetwork) { return ''; }
        DayPrices.prices[instance.dayIndex].changed.get();
        //Session.get('latestClaim'); // Day Claimed; Price/Owner changed

        const priceObj = DayPrices.prices[instance.dayIndex].price;
        return instance.eth.web3.fromWei(priceObj, 'ether').toString(10);
    },

    getCurrentOwner() {
        const instance = Template.instance();
        const ownerName = instance.ownerName.get();
        const address = DayPrices.owners[instance.dayIndex].address;
        if (Helpers.isAddressZero(address)) { return ''; }
        return ownerName;
    },

    getColorFromAddress() {
        const instance = Template.instance();
        const ownerName = instance.ownerName.get();
        const address = DayPrices.owners[instance.dayIndex].address;
        return Helpers.getStylesForAddress(address);
    },

    hasHoliday() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex;
        return !_.isUndefined(_.find(HOLIDAY_ICON_MAP, {dayIndex}));
    },

    getHolidayIcon() {
        const instance = Template.instance();
        const dayIndex = instance.dayIndex;
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return holiday.img;
    },

    getHolidayTitle() {
        const instance = Template.instance();
        TAPi18n.getLanguage();
        const dayIndex = instance.dayIndex;
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return TAPi18n.__(holiday.title);
    },

    getHolidayDesc() {
        const instance = Template.instance();
        TAPi18n.getLanguage();
        const dayIndex = instance.dayIndex;
        const holiday = _.find(HOLIDAY_ICON_MAP, {dayIndex}) || {};
        return TAPi18n.__(holiday.desc);
    }

});
