export class GameUtils {
    static gotoWiki(args) {
        const url = args.locale == "ru" ? "https://demensdeum.com/masonry-ar-wiki-ru/" : "https://translate.google.com/translate?sl=auto&tl=en&hl=en&u=https://demensdeum.com/masonry-ar-wiki-ru/&client=webapp";
        window.location.assign(url);
    }
}
