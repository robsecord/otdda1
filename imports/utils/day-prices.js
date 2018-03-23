
export const DayPrices = {
    initialLoad : new ReactiveVar(true),
    prices      : [],
    owners      : [],

    leaders : {
        first: {
            price: 0,
            days: []
        },
        second: {
            price: 0,
            days: []
        },
        third: {
            price: 0,
            days: []
        },
        changed: new ReactiveVar('')
    }
};
