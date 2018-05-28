const fs = require('fs');
const request = require('request');
const _ = require('lodash');
const Promise = require('bluebird');

class Scrapper {

    constructor(dir, data) {
        console.log('Initialization... ');

        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir);
        }
        this.data = data;
    }

    makeMagic() {
        return Promise.resolve()
            .then(this.mergeLikedPosts.bind(this))
            .then(this.prepareImages.bind(this))
            .then(this.saveImages.bind(this))
            .then(this.saveInJson.bind(this))
            .then(this.finish)
    }

    /** SYNC method, which takes too much time */
    saveImages2(imageArray) {
        return Promise
            .reduce(imageArray, (accum, image, index) => {
                const percentage = ((index / imageArray.length) * 100).toFixed(1);
                return new Promise(
                    (resolve) => {

                        console.log(`Processing... ${image.name.replace(ops.likedDir + '/', '')} -- ${percentage} %`);

                        return this.saveImage(image.url, image.name, () => resolve(image));
                    })
                    .then((img) => {
                        accum.push(img);
                        return accum;
                    });
            }, [])
            .then((result) => result);
    }

    saveImages(imageArray) {
        let index = 0;
        console.log('Starting download...');

        return Promise
            .map(imageArray, (image) => {
                return new Promise((resolve) =>
                    this.saveImage(image.url, image.name, () => resolve(image)))
                    .then((img) => {
                        const percentage = ((index / imageArray.length) * 100).toFixed(1);
                        index--;
                        console.log(`Processing... ${image.name.replace(ops.likedDir + '/', '')} -- ${percentage} %`);
                        return img;
                    });
            })
            .then((result) => result);
    }

    saveImage(uri, photoName, callback) {
        return request.head(uri, () => {
            return request(uri).pipe(fs.createWriteStream(photoName)).on('close', callback);
        });
    }

    mergeLikedPosts() {
        console.log('Preparing posts...');

        let wholeArray = [];

        if (this.data.items) {
            wholeArray = this.data.items;
        } else {
            wholeArray = this.data.liked.newValue.items.concat(this.data.liked.oldValue.items);
        }

        const allData = _.uniqBy(wholeArray, 'code');
        console.log('Posts prepared, total: ', allData.length, ' items');
        return allData;
    }

    getPhotoName(image) {
        let fullName = image.caption ? image.caption.user.full_name : image.user.full_name;
        fullName = fullName.replace('/', '');
        return `${ops.likedDir}/${fullName}_${this.randomString()}.jpeg`;
    }

    randomString() {
        let text = '';
        const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        _.times(5, () => text += possible.charAt(Math.floor(Math.random() * possible.length)));
        return text;
    }


    prepareImages(data) {
        let prepared = [];

        _.each(data, (processingImage) => {

            if (processingImage.image_versions2) {

                const imageObject = this.imageInterface(processingImage);
                return imageObject && prepared.push(imageObject);

            }

            if (!processingImage.image_versions2 && processingImage.carousel_media) {
                const carouselArray = [];

                _.each(processingImage.carousel_media, (item) => {
                    const imageObject = this.imageInterface(item, processingImage);
                    imageObject && carouselArray.push(imageObject);
                });

                prepared = prepared.concat(...carouselArray);
                return prepared;
            }

        });
        console.log(`Images prepared, total: ${prepared.length}`);
        return prepared;
    }

    imageInterface(image, processingImage) {
        const imageUrl = this.getImageUrl(image.image_versions2);
        return {
            url: imageUrl,
            id: processingImage && processingImage.code || image.code,
            name: this.getPhotoName(processingImage || image)
        };
    }

    getImageUrl(imageVersions) {
        return imageVersions.candidates[0].url;
    }

    saveInJson(data) {
        const path = ops.likedDir + '/saved.json';
        const json = JSON.stringify(data);
        fs.writeFile(path, json, (err) => {
            if (err) {
                console.log('Err while writing file: ', err);
            }
            console.log('JSON saved.');
        });
    }


    finish() {
        console.log(`Download finished.`);
    }

}

const ops = {
    likedDir: './temp/LikedPhotos',
    savedDir: './temp/SavedPhotos'
};
const likedPhotos = require('./data/liked');
const likedScrapper = new Scrapper(ops.likedDir, likedPhotos);
const savedPhotos = require('./data/saved');
const savedScrapper = new Scrapper(ops.savedDir, savedPhotos);

savedScrapper.makeMagic();

/**
 *                  Thoughts

 1. run node server on ec2 with api that can trigger action
 2. before saving data, check by id if it exists in 'saved.json'
 3. replace json with db

 * */