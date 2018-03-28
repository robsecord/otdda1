// Meteor Components
import { _ } from 'lodash';

// App Components
import { MeteorEthereum } from '/imports/utils/meteor-ethereum';
import { Contract } from '/imports/contract/contract-interface';
import { Helpers } from '/imports/utils/common';
import { DayPrices } from '/imports/utils/day-prices';

// Template Components
import '/imports/components/loading/loading.component';
import './most-days.component.html';


Template.mostDaysComponent.onCreated(function Template_mostDaysComponent_onCreated() {
    const instance = this;
    instance.eth = MeteorEthereum.instance();
    instance.contract = Contract.instance();

    const _updateOwnerNames = () => {
        _.forEach(DayPrices.leaders.mostDays, (leader, idx) => {
            if (!leader.owner) { return; }
            Helpers.getFriendlyOwnerName(instance.contract, leader.owner)
                .then(name => instance.ownerNames[idx].set(name))
                .catch(log.error);
        });
    };

    instance.mostDays = new ReactiveVar([{}, {}, {}]);
    instance.ownerNames = [
        new ReactiveVar(''),
        new ReactiveVar(''),
        new ReactiveVar('')
    ];
    instance.autorun(() => {
        DayPrices.leaders.changed.get();
        instance.mostDays.set(DayPrices.leaders.mostDays);
        _updateOwnerNames()
    });
    instance.autorun(() => {
        Session.get('accountNickname');
        Meteor.setTimeout(_updateOwnerNames, 1000);
    });
});

Template.mostDaysComponent.helpers({

    isLoaded() {
        return !DayPrices.initialLoad.get();
    },

    showLoading() {
        const tplData = Template.currentData();
        return tplData.showLoading || false;
    },

    getMostDaysAtIndex(index) {
        const instance = Template.instance();
        const leaders = instance.mostDays.get();
        return _.isUndefined(leaders[index]) ? '' : leaders[index].count;
    },

    getMostDaysOwnerAtIndex(index) {
        const instance = Template.instance();
        const ownerName = instance.ownerNames[index].get();
        return ownerName || '';
    },

    getColorFromAddress(index) {
        const instance = Template.instance();
        const ownerName = instance.ownerNames[index].get();
        const address = _.get(DayPrices.leaders.mostDays[index], 'owner', false);
        if (!address || Helpers.isAddressZero(address)) { return ''; }
        return Helpers.getStylesForAddress(address);
    },

    getBorderColorFromAddress(index) {
        const instance = Template.instance();
        const ownerName = instance.ownerNames[index].get();
        const address = _.get(DayPrices.leaders.mostDays[index], 'owner', false);
        if (!address || Helpers.isAddressZero(address)) { return ''; }
        return Helpers.getStylesForAddress(address, 'border');
    }

});
