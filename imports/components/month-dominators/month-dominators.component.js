// Meteor Components
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { Helpers } from '/imports/utils/common';
import { DayPrices } from '/imports/utils/day-prices';
import { LocaleHelpers } from '/imports/utils/i18n-helpers';

// Template Components
import '/imports/components/loading/loading.component';
import './month-dominators.component.html';


Template.monthDominatorsComponent.onCreated(function Template_monthDominatorsComponent_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    const _updateOwnerNames = () => {
        _.forEach(DayPrices.leaders.monthDomLeaders, (leader, idx) => {
            if (!leader.owner) { return; }
            Helpers.getFriendlyOwnerName(instance.contract, leader.owner)
                .then(name => instance.ownerNames[idx].set(name))
                .catch(log.error);
        });
    };

    instance.monthDominators = new ReactiveVar([{}, {}, {}]);
    instance.ownerNames = [
        new ReactiveVar(''),
        new ReactiveVar(''),
        new ReactiveVar('')
    ];
    instance.autorun(() => {
        DayPrices.leaders.changed.get();
        instance.monthDominators.set(DayPrices.leaders.monthDomLeaders);
        _updateOwnerNames();
    });
    instance.autorun(() => {
        Session.get('accountNickname');
        Meteor.setTimeout(_updateOwnerNames, 1000);
    });
});

Template.monthDominatorsComponent.helpers({

    isLoaded() {
        return !DayPrices.initialLoad.get();
    },

    showLoading() {
        const tplData = Template.currentData();
        return tplData.showLoading || false;
    },

    getMonthDominatorsAtIndex(index) {
        const instance = Template.instance();
        const leaders = instance.monthDominators.get();
        return _.isUndefined(leaders[index]) ? '' : leaders[index].count;
    },

    getMonthDominatorsMonthAtIndex(index) {
        const instance = Template.instance();
        const leaders = instance.monthDominators.get();
        return _.isUndefined(leaders[index]) ? '' : LocaleHelpers.formatDate('MMMM', leaders[index].month, 1);
    },

    getMonthDominatorsOwnerAtIndex(index) {
        const instance = Template.instance();
        const ownerName = instance.ownerNames[index].get();
        return ownerName || '';
    },

    getColorFromAddress(index) {
        const instance = Template.instance();
        const ownerName = instance.ownerNames[index].get();
        const address = _.get(DayPrices.leaders.monthDomLeaders[index], 'owner', false);
        if (!address || Helpers.isAddressZero(address)) { return ''; }
        return Helpers.getStylesForAddress(address);
    },

    getBorderColorFromAddress(index) {
        const instance = Template.instance();
        const ownerName = instance.ownerNames[index].get();
        const address = _.get(DayPrices.leaders.monthDomLeaders[index], 'owner', false);
        if (!address || Helpers.isAddressZero(address)) { return ''; }
        return Helpers.getStylesForAddress(address, 'border');
    }

});
