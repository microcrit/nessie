# Nessie
Is an automated web scraper for downloading Linux torrent files.   
Nessie comes pre-packaged with a basic, simple language to configure scraping and tons of scripts for every distro you want.   
   
## Shortcomings
- Nessie does not automatically generate a repository of ISO files for you to use. For that, you will have to load each torrent file into a torrenting client such as qBitTorrent.
    - I can implement automatic downloading as an optional feature in the future using WebTorrent.
- Nessie mainly relies on FOSSTorrent to source torrents. I expect to migrate to official repositories in the future.
- Nessie does not support downloading regular files, only torrent files, meaning it is impossible to download Tiny Core Linux/some Puppy ISOs since they don't provide torrents.
    - I can implement support for downloading regular files manually, but they will be excluded from the torrents folder and downloaded separately.
   

~ crit